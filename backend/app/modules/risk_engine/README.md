# Risk Engine Module

The Risk Engine is the core scoring mechanism for Cyber360.

It performs the following functions:
- Transforms raw check results from the monitoring module into actionable risks (`Risk` model)
- Calculates the Cyber360 score (0-100 scale) for organizations
- Maintains historical sub-scores (`Score` model) for trend analysis
- Prioritizes risks based on severity, exploitability, and business impact.
