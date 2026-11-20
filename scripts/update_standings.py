#!/usr/bin/env python3
"""Log into World Sim Series, paginate all Finished Series in /series-manager#/, open each series' final round standings, and save Top 3 podiums."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://paddock.worldsimseries.com/login"
SERIES_MANAGER_URL = "https://paddock.worldsimseries.com/series-manager#/"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "standings.json"

ALPHA3_TO_2 = {
    "LVA": "LV", "LTU": "LT", "EST": "EE", "DEU": "DE", "GER": "DE",
    "GBR": "GB", "ENG": "GB", "SCO": "GB", "WAL": "GB", "UK": "GB",
    "USA": "US", "FRA": "FR", "ITA": "IT", "ESP": "ES", "NLD": "NL",
    "BEL": "BE", "POL": "PL", "FIN": "FI", "SWE": "SE", "NOR": "NO",
    "DNK": "DK", "AUT": "AT", "CHE": "CH", "CZE": "CZ", "SVK": "SK",
    "HUN": "HU", "ROU": "RO", "BGR": "BG", "UKR": "UA", "PRT": "PT",
    "IRL": "IE", "AUS": "AU", "NZL": "NZ", "CAN": "CA", "BRA": "BR",
    "ARG": "AR", "JPN": "JP", "KOR": "KR", "GRC": "GR", "TUR": "TR",
    "HRV": "HR", "SVN": "SI", "SRB": "RS", "ZAF": "ZA", "MEX": "MX",
    "LATVIA": "LV", "LITHUANIA": "LT", "ESTONIA": "EE", "GERMANY": "DE",
    "UNITEDKINGDOM": "GB", "GREATBRITAIN": "GB", "ENGLAND": "GB",
    "UNITEDSTATES": "US", "FRANCE": "FR", "ITALY": "IT", "SPAIN": "ES",
    "NETHERLANDS": "NL", "BELGIUM": "BE", "POLAND": "PL", "FINLAND": "FI",
    "SWEDEN": "SE", "NORWAY": "NO", "DENMARK": "DK", "AUSTRIA": "AT",
    "SWITZERLAND": "CH", "CZECHIA": "CZ", "CZECHREPUBLIC": "CZ",
    "SLOVAKIA": "SK", "HUNGARY": "HU", "ROMANIA": "RO", "BULGARIA": "BG",
    "UKRAINE": "UA", "PORTUGAL": "PT", "IRELAND": "IE", "AUSTRALIA": "AU",
    "NEWZEALAND": "NZ", "CANADA": "CA", "BRAZIL
