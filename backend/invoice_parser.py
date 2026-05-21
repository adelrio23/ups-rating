"""
Invoice parser: auto-detects column headers from carrier invoices,
handles UPS/FedEx/DHL layouts, and extracts package-level data.
"""
import pandas as pd
import numpy as np
import re
from typing import Optional


COLUMN_ALIASES = {
    "weight": [
        "billed weight", "billable weight", "charged weight", "weight",
        "wgt", "billed wgt", "pkg weight", "package weight",
    ],
    "zone": [
        "zone", "delivery zone", "ship zone", "rate zone",
    ],
    "service": [
        "service", "service type", "service level", "svc", "service description",
        "ship service", "shipping service",
    ],
    "base_charge": [
        "transportation charge", "base charge", "base freight", "freight charge",
        "net charge", "base rate", "published rate", "ground charge",
    ],
    "fuel_surcharge": [
        "fuel surcharge", "fuel", "fuel surchg", "fuel s/c", "energy surcharge",
    ],
    "das_charge": [
        "delivery area surcharge", "das", "das charge", "delivery area",
        "rural surcharge", "residential delivery area",
    ],
    "das_extended": [
        "das extended", "extended das", "extended delivery area",
        "extended delivery area surcharge",
    ],
    "residential_charge": [
        "residential", "residential delivery", "residential surcharge", "res delivery",
    ],
    "address_correction": [
        "address correction", "address correction charge", "addr correction",
    ],
    "additional_handling": [
        "additional handling", "add handling", "additional handling charge",
    ],
    "declared_value": [
        "declared value", "insurance", "declared value charge",
    ],
    "tracking": [
        "tracking number", "tracking #", "tracking no", "shipment id",
        "package id", "pkg id", "ups tracking", "fedex tracking",
    ],
    "invoice_date": [
        "invoice date", "ship date", "shipment date", "date",
    ],
    "reference": [
        "reference", "po number", "reference number", "customer ref",
    ],
    "total_charge": [
        "total charge", "net amount", "total", "invoice amount", "amount",
        "total invoice", "net charge total",
    ],
    "correction_flag": [
        "correction", "rebill", "adjustment", "credit", "debit memo",
        "correction indicator",
    ],
    "origin_zip": [
        "origin zip", "shipper zip", "from zip", "origin postal",
    ],
    "dest_zip": [
        "destination zip", "consignee zip", "to zip", "dest zip",
        "recipient zip",
    ],
}

SERVICE_NORMALIZATION = {
    "ground": "ground_commercial",
    "ups ground": "ground_commercial",
    "fedex ground": "ground_commercial",
    "ground commercial": "ground_commercial",
    "ground residential": "ground_residential",
    "ups ground residential": "ground_residential",
    "home delivery": "ground_residential",
    "fedex home delivery": "ground_residential",
    "2 day": "2da",
    "2nd day": "2da",
    "2nd day air": "2da",
    "ups 2nd day air": "2da",
    "2 day air": "2da",
    "fedex 2day": "2da",
    "fedex 2 day": "2da",
    "next day": "nda",
    "next day air": "nda",
    "ups next day air": "nda",
    "overnight": "nda",
    "priority overnight": "nda",
    "fedex priority overnight": "nda",
    "fedex standard overnight": "nda",
    "next day air saver": "nda_saver",
    "ups next day air saver": "nda_saver",
    "3 day": "3da",
    "3 day select": "3da",
    "ups 3 day select": "3da",
    "fedex express saver": "3da",
}


def normalize_col(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", str(s).lower()).strip()


def auto_detect_columns(df: pd.DataFrame) -> dict:
    """Return {canonical_field: actual_column_name} for best-match columns."""
    mapping = {}
    cols_normalized = {normalize_col(c): c for c in df.columns}

    for canonical, aliases in COLUMN_ALIASES.items():
        best = None
        best_score = 0
        for alias in aliases:
            alias_norm = normalize_col(alias)
            for col_norm, col_orig in cols_normalized.items():
                # exact match
                if alias_norm == col_norm:
                    best = col_orig
                    best_score = 100
                    break
                # substring match
                if alias_norm in col_norm or col_norm in alias_norm:
                    score = len(alias_norm) / max(len(col_norm), 1) * 80
                    if score > best_score:
                        best = col_orig
                        best_score = score
            if best_score == 100:
                break
        if best:
            mapping[canonical] = best
    return mapping


def normalize_service(raw: str) -> str:
    if pd.isna(raw):
        return "ground_commercial"
    norm = normalize_col(str(raw))
    for key, val in SERVICE_NORMALIZATION.items():
        if normalize_col(key) == norm or normalize_col(key) in norm:
            return val
    return "ground_commercial"


def is_correction_row(row: dict, correction_col: Optional[str]) -> bool:
    """Detect dim weight corrections, rebills, credits."""
    if correction_col and row.get(correction_col):
        val = str(row[correction_col]).lower()
        if any(x in val for x in ["correction", "rebill", "credit", "adjustment", "dim"]):
            return True
    # negative base charge = credit
    try:
        if float(row.get("base_charge", 0) or 0) < 0:
            return True
    except (ValueError, TypeError):
        pass
    return False


def clean_currency(val) -> float:
    if pd.isna(val) or val == "" or val is None:
        return 0.0
    try:
        return float(str(val).replace("$", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def clean_weight(val) -> float:
    if pd.isna(val) or val == "" or val is None:
        return 1.0
    try:
        w = float(str(val).replace("lbs", "").replace("lb", "").strip())
        return max(1.0, w)
    except (ValueError, TypeError):
        return 1.0


def clean_zone(val) -> Optional[int]:
    if pd.isna(val) or val == "" or val is None:
        return None
    try:
        z = int(float(str(val).strip()))
        if 2 <= z <= 8:
            return z
    except (ValueError, TypeError):
        pass
    return None


def parse_invoice(filepath: str, sheet_name: int = 0) -> dict:
    """
    Parse an invoice Excel file.
    Returns {packages: [...], column_mapping: {...}, raw_columns: [...],
             auto_detected: bool, fuel_pct_detected: float|None}
    """
    try:
        df = pd.read_excel(filepath, sheet_name=sheet_name, dtype=str)
    except Exception:
        # try first sheet by name
        xl = pd.ExcelFile(filepath)
        df = pd.read_excel(filepath, sheet_name=xl.sheet_names[0], dtype=str)

    # drop fully empty rows/cols
    df = df.dropna(how="all").reset_index(drop=True)
    df.columns = [str(c).strip() for c in df.columns]

    mapping = auto_detect_columns(df)
    raw_columns = list(df.columns)

    # Try to detect fuel surcharge percentage from data
    fuel_pct_detected = None
    if "base_charge" in mapping and "fuel_surcharge" in mapping:
        base_col = mapping["base_charge"]
        fuel_col = mapping["fuel_surcharge"]
        sample = df[[base_col, fuel_col]].dropna().head(100)
        ratios = []
        for _, row in sample.iterrows():
            b = clean_currency(row[base_col])
            f = clean_currency(row[fuel_col])
            if b > 0:
                ratios.append(f / b)
        if ratios:
            median_ratio = float(np.median(ratios))
            if 0.05 < median_ratio < 0.5:
                fuel_pct_detected = round(median_ratio * 100, 2)

    packages = []
    for _, row in df.iterrows():
        pkg = {}

        def get(field):
            col = mapping.get(field)
            return row[col] if col else None

        base = clean_currency(get("base_charge"))
        if base == 0:
            continue  # skip header repeats / empty rows

        weight = clean_weight(get("weight"))
        zone = clean_zone(get("zone"))
        service = normalize_service(get("service"))
        fuel = clean_currency(get("fuel_surcharge"))
        das = clean_currency(get("das_charge"))
        das_ext = clean_currency(get("das_extended"))
        residential = clean_currency(get("residential_charge"))
        addr_corr = clean_currency(get("address_correction"))
        add_handling = clean_currency(get("additional_handling"))
        declared_val = clean_currency(get("declared_value"))
        total = clean_currency(get("total_charge"))
        tracking = str(get("tracking") or "").strip()
        ref = str(get("reference") or "").strip()
        origin_zip = str(get("origin_zip") or "").strip()
        dest_zip = str(get("dest_zip") or "").strip()
        correction_flag = is_correction_row(dict(row), mapping.get("correction_flag"))

        # Compute total if not provided
        if total == 0:
            total = base + fuel + das + das_ext + residential + addr_corr + add_handling + declared_val

        pkg = {
            "weight": weight,
            "zone": zone,
            "service": service,
            "base_charge": base,
            "fuel_surcharge": fuel,
            "das_charge": das,
            "das_extended": das_ext,
            "residential_charge": residential,
            "address_correction": addr_corr,
            "additional_handling": add_handling,
            "declared_value": declared_val,
            "total_charge": total,
            "tracking": tracking,
            "reference": ref,
            "origin_zip": origin_zip,
            "dest_zip": dest_zip,
            "correction_flag": correction_flag,
        }
        packages.append(pkg)

    return {
        "packages": packages,
        "column_mapping": mapping,
        "raw_columns": raw_columns,
        "auto_detected": len(mapping) >= 3,
        "fuel_pct_detected": fuel_pct_detected,
        "total_packages": len(packages),
        "corrections_flagged": sum(1 for p in packages if p["correction_flag"]),
    }


def parse_rate_card(filepath: str) -> dict:
    """
    Parse a carrier rate card Excel file.
    Expected format: rows = weights, columns = zones 2-8.
    Returns {service_type: {weight: {zone: rate}}} for each sheet/tab.
    """
    xl = pd.ExcelFile(filepath)
    service_map = {
        "ground": "ground_commercial",
        "ground commercial": "ground_commercial",
        "commercial": "ground_commercial",
        "ground residential": "ground_residential",
        "residential": "ground_residential",
        "home delivery": "ground_residential",
        "2da": "2da",
        "2nd day": "2da",
        "2nd day air": "2da",
        "nda": "nda",
        "next day": "nda",
        "next day air": "nda",
        "overnight": "nda",
    }

    result = {}
    for sheet in xl.sheet_names:
        sheet_norm = normalize_col(sheet)
        service = None
        for key, val in service_map.items():
            if key in sheet_norm:
                service = val
                break
        if service is None:
            # default to ground commercial for first sheet
            service = "ground_commercial" if not result else None
        if service is None:
            continue

        df = pd.read_excel(filepath, sheet_name=sheet, index_col=0)
        df.index = df.index.astype(str)
        df.columns = df.columns.astype(str)

        rates = {}
        for idx, row in df.iterrows():
            # weight is in index
            try:
                w = int(float(str(idx).replace("lbs", "").strip()))
            except (ValueError, TypeError):
                continue
            if not (1 <= w <= 150):
                continue
            for col, val in row.items():
                try:
                    z = int(float(str(col).strip()))
                except (ValueError, TypeError):
                    continue
                if not (2 <= z <= 8):
                    continue
                try:
                    rate = float(str(val).replace("$", "").replace(",", "").strip())
                    if rate > 0:
                        if w not in rates:
                            rates[w] = {}
                        rates[w][z] = rate
                except (ValueError, TypeError):
                    pass

        if rates:
            if service not in result:
                result[service] = rates
            # merge if same service appears on multiple sheets
            else:
                for w, zones in rates.items():
                    if w not in result[service]:
                        result[service][w] = zones
                    else:
                        result[service][w].update(zones)

    return result
