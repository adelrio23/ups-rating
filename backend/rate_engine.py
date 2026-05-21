"""
Hybrid cost engine: finds cheapest carrier per weight/zone/service cell,
computes costs, sell prices, margins, and package-level P&L.
"""
from typing import Optional


WEIGHT_BREAKPOINTS = list(range(1, 151))
ZONES = list(range(2, 9))
SERVICES = ["ground_commercial", "ground_residential", "2da", "nda"]


def get_rate(rate_card: dict, weight: int, zone: int) -> Optional[float]:
    """Look up rate for exact weight, or next-higher weight break."""
    weights = sorted(rate_card.keys())
    for w in weights:
        if w >= weight:
            zones = rate_card[w]
            return zones.get(zone) or zones.get(str(zone))
    return None


def build_rate_source_map(rate_cards: list[dict], service: str) -> dict:
    """
    Given list of {id, name, service_type, rates} dicts,
    build the hybrid best-cost grid for one service type.
    Returns {weight: {zone: {rate, carrier_id, carrier_name}}}
    """
    result = {}
    # only cards that have this service
    cards = [rc for rc in rate_cards if rc.get("service_type") == service or
             (service in (rc.get("rates") or {}))]

    for weight in WEIGHT_BREAKPOINTS:
        result[weight] = {}
        for zone in ZONES:
            best_rate = None
            best_carrier_id = None
            best_carrier_name = None
            for card in cards:
                # rates may be nested under service key or flat
                rates_data = card.get("rates", {})
                if isinstance(rates_data, dict):
                    # check if nested by service
                    if service in rates_data:
                        service_rates = rates_data[service]
                    else:
                        service_rates = rates_data
                else:
                    continue
                # convert string keys to int
                service_rates_int = {}
                for k, v in service_rates.items():
                    try:
                        service_rates_int[int(k)] = {
                            int(zk) if str(zk).isdigit() else zk: zv
                            for zk, zv in v.items()
                        }
                    except (ValueError, TypeError):
                        pass
                rate = get_rate(service_rates_int, weight, zone)
                if rate is not None:
                    if best_rate is None or rate < best_rate:
                        best_rate = rate
                        best_carrier_id = card.get("id")
                        best_carrier_name = card.get("name")
            if best_rate is not None:
                result[weight][zone] = {
                    "rate": best_rate,
                    "carrier_id": best_carrier_id,
                    "carrier_name": best_carrier_name,
                }
    return result


def build_all_rate_source_maps(rate_cards: list[dict]) -> dict:
    """Returns {service: rate_source_map}"""
    return {svc: build_rate_source_map(rate_cards, svc) for svc in SERVICES}


def compute_fuel_adjusted_cost(base_rate: float, fuel_pct: float) -> float:
    return base_rate * (1 + fuel_pct / 100)


def compute_sell_price(best_cost: float, markup_pct: float) -> float:
    return best_cost * (1 + markup_pct / 100)


def classify_package(sell_total: float, customer_total: float, our_cost_total: float) -> str:
    """green=saves money, grey=match, red=can't compete"""
    if sell_total < customer_total:
        return "green"
    elif our_cost_total < customer_total:
        return "grey"
    else:
        return "red"


def price_package(
    pkg: dict,
    rate_source_map: dict,
    our_fuel_pct: float,
    customer_fuel_pct: float,
    markup_pct: float,
    accessorial_config: dict,
    volume_multiplier: float = 1.0,
) -> dict:
    """
    Full P&L for one package.
    Returns extended dict with: best_rate, carrier_id, carrier_name,
    our_cost_base, our_cost_total, sell_base, sell_total,
    customer_total, margin, status, audit_trail.
    """
    weight = int(round(pkg.get("weight", 1)))
    zone = pkg.get("zone")
    service = pkg.get("service", "ground_commercial")

    service_map = rate_source_map.get(service, {})
    weight_map = service_map.get(weight, {})
    cell = weight_map.get(zone) if zone else None

    # Auditable trail
    audit = {
        "weight": weight,
        "zone": zone,
        "service": service,
        "markup_pct": markup_pct,
        "our_fuel_pct": our_fuel_pct,
        "customer_fuel_pct": customer_fuel_pct,
    }

    if cell:
        best_rate = cell["rate"]
        carrier_id = cell["carrier_id"]
        carrier_name = cell["carrier_name"]
    else:
        best_rate = None
        carrier_id = None
        carrier_name = None

    audit["best_rate"] = best_rate
    audit["carrier_id"] = carrier_id
    audit["carrier_name"] = carrier_name

    # Accessorial costs (our cost = pass-through or discounted)
    acc_our_cost = compute_accessorial_cost(pkg, accessorial_config, side="cost")
    acc_sell = compute_accessorial_cost(pkg, accessorial_config, side="sell")
    acc_customer = (
        pkg.get("das_charge", 0) +
        pkg.get("das_extended", 0) +
        pkg.get("residential_charge", 0) +
        pkg.get("address_correction", 0) +
        pkg.get("additional_handling", 0) +
        pkg.get("declared_value", 0)
    )

    customer_base = pkg.get("base_charge", 0)
    customer_fuel = pkg.get("fuel_surcharge", 0)
    customer_total = pkg.get("total_charge", 0)

    audit["customer_base"] = customer_base
    audit["customer_fuel"] = customer_fuel
    audit["customer_total"] = customer_total
    audit["acc_customer"] = acc_customer
    audit["acc_our_cost"] = acc_our_cost
    audit["acc_sell"] = acc_sell

    if best_rate is None:
        return {
            **pkg,
            "best_rate": None,
            "carrier_id": carrier_id,
            "carrier_name": carrier_name,
            "our_cost_base": None,
            "our_cost_total": None,
            "sell_base": None,
            "sell_total": None,
            "customer_total": customer_total,
            "margin": None,
            "margin_pct": None,
            "status": "no_rate",
            "audit": audit,
        }

    our_cost_base = compute_fuel_adjusted_cost(best_rate, our_fuel_pct)
    our_cost_total = our_cost_base + acc_our_cost
    audit["our_cost_base"] = our_cost_base
    audit["our_cost_total"] = our_cost_total

    sell_base = compute_sell_price(best_rate, markup_pct)
    sell_fuel = sell_base * customer_fuel_pct / 100
    sell_total = sell_base + sell_fuel + acc_sell
    audit["sell_base"] = sell_base
    audit["sell_fuel"] = sell_fuel
    audit["sell_total"] = sell_total

    margin = sell_total - our_cost_total
    margin_pct = (margin / sell_total * 100) if sell_total > 0 else 0
    audit["margin"] = margin
    audit["margin_pct"] = margin_pct

    status = classify_package(sell_total, customer_total, our_cost_total)
    if pkg.get("correction_flag"):
        status = "correction"
    audit["status"] = status

    return {
        **pkg,
        "best_rate": best_rate,
        "carrier_id": carrier_id,
        "carrier_name": carrier_name,
        "our_cost_base": our_cost_base,
        "our_cost_total": our_cost_total,
        "sell_base": sell_base,
        "sell_fuel": sell_fuel,
        "sell_total": sell_total,
        "customer_total": customer_total,
        "customer_savings": max(0, customer_total - sell_total),
        "margin": margin,
        "margin_pct": margin_pct,
        "status": status,
        "audit": audit,
    }


def compute_accessorial_cost(pkg: dict, config: dict, side: str = "cost") -> float:
    """
    Apply accessorial config to package.
    config example:
    {
      "das": {"our_rate": 4.50, "customer_rate": 5.00, "passthrough": false},
      "das_extended": {...},
      ...
    }
    side = "cost" (what we pay) or "sell" (what we charge)
    """
    if not config:
        # passthrough mode: use invoice amounts as-is
        return (
            pkg.get("das_charge", 0) +
            pkg.get("das_extended", 0) +
            pkg.get("residential_charge", 0) +
            pkg.get("address_correction", 0) +
            pkg.get("additional_handling", 0) +
            pkg.get("declared_value", 0)
        )

    total = 0.0
    field_map = {
        "das": "das_charge",
        "das_extended": "das_extended",
        "residential": "residential_charge",
        "address_correction": "address_correction",
        "additional_handling": "additional_handling",
        "declared_value": "declared_value",
    }

    for acc_key, pkg_field in field_map.items():
        pkg_amt = pkg.get(pkg_field, 0)
        if pkg_amt == 0:
            continue
        acc_cfg = config.get(acc_key, {})
        if not acc_cfg:
            total += pkg_amt
            continue

        passthrough = acc_cfg.get("passthrough", True)
        if passthrough:
            total += pkg_amt
        else:
            if side == "cost":
                total += acc_cfg.get("our_rate", pkg_amt)
            else:
                total += acc_cfg.get("customer_rate", pkg_amt)

    return total


def run_scenario(
    packages: list[dict],
    rate_cards: list[dict],
    our_fuel_pct: float,
    published_fuel_pct: float,
    customer_fuel_pct: float,
    markup_pct: float,
    accessorial_config: dict,
    volume_multiplier: float = 1.0,
) -> dict:
    """Run full scenario across all packages. Returns summary + per-package results."""
    rate_source_maps = build_all_rate_source_maps(rate_cards)

    results = []
    for pkg in packages:
        service = pkg.get("service", "ground_commercial")
        rsm = rate_source_maps.get(service, {})
        priced = price_package(
            pkg, rsm, our_fuel_pct, customer_fuel_pct,
            markup_pct, accessorial_config, volume_multiplier
        )
        results.append(priced)

    # Exclude corrections from savings summary
    active = [r for r in results if not r.get("correction_flag") and r.get("status") != "correction"]

    green = [r for r in active if r["status"] == "green"]
    grey = [r for r in active if r["status"] == "grey"]
    red = [r for r in active if r["status"] == "red"]
    no_rate = [r for r in active if r["status"] == "no_rate"]

    def safe_sum(lst, field):
        return sum(r.get(field) or 0 for r in lst)

    multiplier = volume_multiplier

    summary = {
        "total_packages": len(active),
        "green_count": len(green),
        "grey_count": len(grey),
        "red_count": len(red),
        "no_rate_count": len(no_rate),
        "corrections_count": len(results) - len(active),
        # Customer current
        "customer_total_monthly": safe_sum(active, "customer_total") * multiplier,
        # Our cost
        "our_cost_total_monthly": safe_sum(active, "our_cost_total") * multiplier,
        # Sell
        "sell_total_monthly": safe_sum(active, "sell_total") * multiplier,
        # Customer savings (green only)
        "customer_savings_monthly": safe_sum(green, "customer_savings") * multiplier,
        # Margin
        "margin_monthly": safe_sum(active, "margin") * multiplier,
        "margin_pct": (
            safe_sum(active, "margin") / safe_sum(active, "sell_total") * 100
            if safe_sum(active, "sell_total") > 0 else 0
        ),
        # Per-service breakdown
        "by_service": _service_breakdown(active, multiplier),
        "fuel_spread_pct": customer_fuel_pct - our_fuel_pct,
        "markup_pct": markup_pct,
        "our_fuel_pct": our_fuel_pct,
        "customer_fuel_pct": customer_fuel_pct,
        "volume_multiplier": multiplier,
    }

    return {
        "summary": summary,
        "packages": results,
        "rate_source_maps": {
            svc: _serialize_rsm(rsm)
            for svc, rsm in rate_source_maps.items()
        },
    }


def _service_breakdown(packages: list[dict], multiplier: float) -> dict:
    breakdown = {}
    for pkg in packages:
        svc = pkg.get("service", "unknown")
        if svc not in breakdown:
            breakdown[svc] = {"count": 0, "customer_total": 0, "our_cost": 0, "sell_total": 0, "margin": 0}
        breakdown[svc]["count"] += 1
        breakdown[svc]["customer_total"] += (pkg.get("customer_total") or 0) * multiplier
        breakdown[svc]["our_cost"] += (pkg.get("our_cost_total") or 0) * multiplier
        breakdown[svc]["sell_total"] += (pkg.get("sell_total") or 0) * multiplier
        breakdown[svc]["margin"] += (pkg.get("margin") or 0) * multiplier
    return breakdown


def _serialize_rsm(rsm: dict) -> dict:
    """Convert int keys to strings for JSON serialization."""
    return {
        str(w): {str(z): cell for z, cell in zones.items()}
        for w, zones in rsm.items()
    }


def build_grid_tables(rate_source_map: dict) -> dict:
    """
    For export: build flat grid tables indexed by (weight, zone).
    Returns {best_rate: [[...]], carrier: [[...]], ...}
    """
    weights = sorted(int(w) for w in rate_source_map.keys())
    zones = ZONES

    best_rates = []
    carriers = []

    for w in weights:
        row_rates = []
        row_carriers = []
        for z in zones:
            cell = rate_source_map.get(w, {}).get(z)
            if cell:
                row_rates.append(cell["rate"])
                row_carriers.append(cell["carrier_name"] or "")
            else:
                row_rates.append(None)
                row_carriers.append("")
        best_rates.append(row_rates)
        carriers.append(row_carriers)

    return {
        "weights": weights,
        "zones": zones,
        "best_rates": best_rates,
        "carriers": carriers,
    }
