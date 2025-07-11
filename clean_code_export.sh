#!/bin/bash

# Copy just the files that are tracked by git to a sibling folder and
# create fake confidential files from the examples.

# This is helpful to upload a public version of the code to an AI tool.

# Define the sibling folder path
SIBLING_FOLDER="../sunlight_sensor_gcp_shared"

# Step 1: Delete everything in the sibling folder
if [ -d "$SIBLING_FOLDER" ]; then
  echo "Deleting contents of $SIBLING_FOLDER..."
  rm -rf "$SIBLING_FOLDER"/*
else
  echo "Creating $SIBLING_FOLDER..."
  mkdir -p "$SIBLING_FOLDER"
fi

# Step 2: Copy all files tracked by Git into the sibling folder
echo "Copying files tracked by Git into $SIBLING_FOLDER..."
git ls-files --cached --others --exclude-standard | while read -r file; do
  # Create the directory structure in the sibling folder
  mkdir -p "$SIBLING_FOLDER/$(dirname "$file")"
  # Copy the file
  cp "$file" "$SIBLING_FOLDER/$file"
done

# Step 3: Rename files ending with _example in the sibling folder
echo "Renaming files ending with _example in $SIBLING_FOLDER..."
find "$SIBLING_FOLDER" -type f -name "*_example" | while read -r file; do
  mv "$file" "${file%_example}"
done

echo "Script completed successfully."