// Generated from docs/tolerance-matrix.json by scripts/sync-matrix.js. Do not edit by hand.
var TOLERANCE_MATRIX = {
  "label": "Sample policy: placeholder limits for a fictional firm, not real requirements",
  "default": {
    "commercial_liability": {
      "required": true,
      "minimum": 1000000
    },
    "aggregate": {
      "required": true,
      "minimum": 2000000
    },
    "auto": {
      "required": true,
      "minimum": 1000000
    },
    "umbrella": {
      "required": true,
      "minimum": 2000000
    },
    "workers_comp": {
      "required": true,
      "minimum": null
    },
    "pollution_liability": {
      "required": false,
      "minimum": null
    },
    "professional_liability": {
      "required": false,
      "minimum": null
    },
    "additional_insured_endorsement": {
      "required": true
    },
    "project_address": {
      "required": true
    },
    "certificate_holder": {
      "required": true
    },
    "insured_name_matches": {
      "required": true
    },
    "cancellation_notice_days": {
      "required": true,
      "minimum": 30
    }
  },
  "scopes": {
    "earthwork": {
      "pollution_liability": {
        "required": true,
        "minimum": 1000000
      }
    },
    "roofing": {
      "pollution_liability": {
        "required": true,
        "minimum": 1000000
      }
    },
    "cleaning": {
      "umbrella": {
        "required": false,
        "minimum": null
      },
      "pollution_liability": {
        "required": false,
        "minimum": null
      }
    }
  }
};
