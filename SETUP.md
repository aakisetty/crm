# Real Estate CRM Setup Guide

## Prerequisites

- Node.js 18+ and Yarn
- MongoDB (local or cloud instance)
- OpenAI API Key
- Real Estate API Key

## Environment Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd real-estate-crm
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` with your actual values:
   
   ```env
   # Database Configuration
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=realestatecrm
   
   # External URL for production
   NEXT_PUBLIC_BASE_URL=https://your-domain.com
   
   # OpenAI API Configuration
   # Get your API key from: https://platform.openai.com/api-keys
   OPENAI_API_KEY=sk-proj-your-actual-openai-api-key-here
   
   # Real Estate API Configuration  
   # Get your API key from: https://developer.realestateapi.com/
   REAL_ESTATE_API_KEY=your-actual-real-estate-api-key-here
   ```

## Required API Keys

### OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Sign in or create an account
3. Create a new API key
4. Copy the key and add it to your `.env` file

### Real Estate API Key
1. Visit https://developer.realestateapi.com/
2. Sign up for an account
3. Generate an API key
4. Copy the key and add it to your `.env` file

## Running the Application

### Development Mode
```bash
yarn dev
```

The application will be available at `http://localhost:3000`

### Production Mode
```bash
yarn build
yarn start
```

## Database Setup

### MongoDB Setup
1. Install MongoDB locally or use MongoDB Atlas (cloud)
2. Update `MONGO_URL` in your `.env` file
3. Run the seed script to populate initial data:
   ```bash
   node seed-data.js
   ```

## Features

- **Lead Management**: CRUD operations for real estate leads
- **AI Assistant**: Natural language processing for lead and property matching
- **Property Search**: Integration with Real Estate API for property listings
- **Transaction Timeline**: Track deals through various stages
- **Deal Summary**: AI-powered deal analysis and alerts
- **Smart Alerts**: Automated notifications for overdue tasks

## API Routes

All backend API routes are prefixed with `/api/`:

- `/api/leads` - Lead management
- `/api/assistant` - AI assistant functionality
- `/api/properties` - Property search
- `/api/transactions` - Transaction management
- `/api/deals` - Deal summaries and alerts

## Security Notes

- Never commit your `.env` file to version control
- The `.gitignore` file is configured to ignore all environment files
- Use the provided `.env.example` as a template
- Store sensitive API keys securely

## Troubleshooting

1. **Port 3000 already in use**: Stop any other processes using port 3000
2. **MongoDB connection issues**: Verify your `MONGO_URL` is correct
3. **API key errors**: Ensure your API keys are valid and have sufficient quota
4. **502 Bad Gateway**: Check if all services are running and properly configured

## Project Structure

```
/app/
├── app/
│   ├── api/[[...path]]/route.js  # Backend API routes
│   ├── page.js                   # Main dashboard
│   └── layout.js                 # App layout
├── components/                   # React components
├── lib/utils/                   # Utility functions
└── .env.example                 # Environment template
```