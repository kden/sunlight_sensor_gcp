# Data Utility Scripts

These scripts can be used to backup and restore the important BigQuery tables to backup tables, and to generate test data.

# How to Use These Scripts

## Setup
1. Save the Files: Place both scripts in a scripts/ directory within your project.

2. Install Dependencies: Ensure you have the necessary library installed. It's best practice to use a Python virtual environment.Shell Script# In your terminal
```
pip install google-cloud-bigquery
```

3. Authenticate & Configure:Shell Script# Authenticate your local environment with GCP
```
gcloud auth application-default login
```

Set your project ID environment variable (replace with your actual ID)
```
export GCP_PROJECT_ID="your-gcp-project-id"
```

## Backup/Restore
### To create a new backup
```
python scripts/backup_bq_tables.py
```

### To clean up old backups (will prompt for confirmation)
```
python scripts/cleanup_old_backups.py
```
### To restore backups (overwriting current data)
```
python scripts/restore_bq_tables.py
```

## Generate test data
### To generate a week's worth of test pattern data and send it to the sensors API endpoint
```
python scripts /generate_test_data.py
```