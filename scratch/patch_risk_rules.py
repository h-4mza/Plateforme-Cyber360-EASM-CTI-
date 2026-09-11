import json
import os

RISK_RULES_PATH = os.path.join("backend", "risk_rules_content.json")

def patch_risk_rules():
    with open(RISK_RULES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for rule_key, rule in data.items():
        severity = rule.get("default_severity", "medium")
        if severity == "critical":
            freq = 0.5
            low = 100000
            high = 500000
        elif severity == "high":
            freq = 0.2
            low = 50000
            high = 200000
        elif severity == "medium":
            freq = 0.1
            low = 10000
            high = 50000
        else: # low
            freq = 0.05
            low = 1000
            high = 10000
            
        rule["loss_magnitude_low"] = low
        rule["loss_magnitude_high"] = high
        rule["frequency_estimate"] = freq
        
    with open(RISK_RULES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        print("Patched risk rules!")

if __name__ == "__main__":
    patch_risk_rules()
