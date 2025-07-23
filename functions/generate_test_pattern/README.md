# Cloud Run Function generate_and_send_data

This function configuration is defined in Terraform as [generate_test_pattern_function](/terraform/cloudrun_generate_test_pattern.tf).

This is a Cloud Run function that is triggered on a schedule.  When it's triggered, it generates a day's worth of fake data.  To show some variation, it shows 4 sine waves, phase shifted so they don't overlap, limited by a bell curve.

Once the data is downsampled to fifteen minute buckets by the export_sensors_to_firestore function, it looks like the pattern below.

![screenshot_sensor_levels_screen.png](/doc_images/screenshot_sensor_levels_screen.png)