# Sunlight Sensor Web App

![screenshot_sensor_levels_screen.png](/doc_images/screenshot_sensor_levels_screen.png)

The core infrastructure for this web app is defined in Terraform in [firebase_webapp.tf](/terraform/firebase_webapp.tf)

This application is deployed as a [GitHub Action](/.github/workflows/deploy_webapp.yml).

## A Word from Next.js:

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites 

npm 10.8.2 and node 20.19.3

## Install the application libraries

```bash
npm install
```

## Firebase Permissions

In the root of the `sunlight_web_app` directory, create an `.env.local` file.  Put the following in the file:

```toml
    NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy...your...api...key"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1234567890"
    NEXT_PUBLIC_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
```

If you used the included Terraform files to create your Firebase app, you can run the following Terraform command to extract these variables:

```shell
terraform output -raw github_actions_service_account_key
terraform output -raw firebase_web_app_config
```


## Run the test server

```bash
npm run dev
```

The app will be loaded at [http://localhost:3000](http://localhost:3000) 
