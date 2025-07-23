# Sunlight Sensor Web App

![screenshot_sensor_levels_screen.png](/doc_images/screenshot_sensor_levels_screen.png)

The core infrastructure for this web app is defined in Terraform in [firebase_webapp.tf](/terraform/firebase_webapp.tf)

This application is deployed as a [GitHub Action](/.github/workflows/deploy_webapp.yml).

## A Word from Next.js:

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites 

npm 10.8.2 and node 20.19.3

## Run the test server

```bash
npm run dev
```

The app will be loaded at [http://localhost:3000](http://localhost:3000) 
