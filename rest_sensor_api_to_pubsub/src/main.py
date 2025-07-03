"""
main.py

Proxies HTTP requests to Google Cloud Pub/Sub, validating a bearer token.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT and Google Gemini.
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
from google.cloud import pubsub_v1
import functions_framework

# Initialize the publisher client once globally. It's safe and efficient.
publisher = pubsub_v1.PublisherClient()


@functions_framework.http
def proxy_to_pubsub(request):
    """
    HTTP Cloud Function to receive a JSON payload, validate a bearer token,
    and publish the payload to a Pub/Sub topic.
    """
    # --- Read environment variables inside the function ---
    # This ensures they are read when the function is executed,
    # making the code testable with patched environments.
    project_id = os.environ.get("GCP_PROJECT")
    topic_id = os.environ.get("TOPIC_ID")
    secret_bearer_token = os.environ.get("SECRET_BEARER_TOKEN")

    # --- Server Configuration Check ---
    if not all([project_id, topic_id, secret_bearer_token]):
        print("ERROR: Service is not configured correctly. Check environment variables.")
        return ("Internal Server Error: Service is not configured.", 500)

    # --- Authentication Check ---
    auth_header = request.headers.get("Authorization")
    expected_token = f"Bearer {secret_bearer_token}"

    if not auth_header or auth_header != expected_token:
        print(f"WARN: Unauthorized access attempt. Provided token: {auth_header}")
        return ("Unauthorized: Invalid or missing bearer token.", 401)

    # --- JSON Payload Validation ---
    if request.content_type != 'application/json':
        return ("Bad Request: Content-Type must be application/json.", 400)

    try:
        data = request.get_json(silent=True)  # Use silent=True to return None on error
        if data is None:
            return ("Bad Request: JSON body is empty or malformed.", 400)
    except Exception as e:
        print(f"ERROR: Could not parse JSON. Error: {e}")
        return ("Bad Request: Invalid JSON format.", 400)

    # --- Publish to Pub/Sub ---
    try:
        topic_path = publisher.topic_path(project_id, topic_id)
        message_data = json.dumps(data).encode("utf-8")
        future = publisher.publish(topic_path, data=message_data)
        message_id = future.result(timeout=10)

        print(f"Successfully published message {message_id} to {topic_path}")
        return (f"Message received and published with ID: {message_id}", 200)

    except Exception as e:
        print(f"ERROR: Failed to publish to Pub/Sub. Error: {e}")
        return ("Internal Server Error: Could not publish message.", 500)

