# Heatmap Hangout

Multiplayer 3D social worlds for GitHub contribution heatmaps. Walk through your commit landscapes with friends, chat in real-time, and unwind after long coding sessions.

## About

Heatmap Hangout transforms GitHub contribution calendars into explorable 3D terrains. Each day's commits become hills and valleys you can walk through with other developers. Features include:

- **3D Terrain Generation**: Real-time conversion of GitHub contribution data into navigable 3D landscapes
- **Multiplayer Support**: Up to 50 developers can explore the same world simultaneously
- **Real-time Chat**: Press `/` to chat with other developers in the world
- **Streak Tracking**: Daily visit streaks unlock avatar skins and trails
- **Smooth 60fps Performance**: Optimized rendering for smooth exploration

## Getting Started

### Prerequisites

- Node.js & npm (or bun) - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Supabase account (for authentication and real-time features)

### Installation

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd heatmap-hangout

# Step 3: Install dependencies
npm install
# or
bun install

# Step 4: Set up environment variables
# Create a .env file with your Supabase credentials
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Step 5: Start the development server
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:8080`

## Technologies

This project is built with:

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe development
- **React** - UI framework
- **React Three Fiber** - 3D rendering
- **shadcn-ui** - UI component library
- **Tailwind CSS** - Styling
- **Supabase** - Backend (authentication, real-time, database)
- **React Router** - Client-side routing

## Project Structure

```
├── src/
│   ├── components/     # React components
│   │   ├── scene/      # 3D scene components
│   │   └── ui/         # shadcn-ui components
│   ├── contexts/       # React contexts (Auth, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── integrations/   # External service integrations
│   ├── pages/          # Page components
│   └── lib/            # Utility functions
├── supabase/
│   ├── functions/      # Edge functions
│   └── migrations/     # Database migrations
└── public/             # Static assets
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Key Features

- **Anonymous Mode**: Explore worlds without signing in
- **Named Mode**: Sign in to track streaks and unlock features
- **Year Selection**: View contributions from different years
- **Real-time Presence**: See other developers moving in real-time
- **World Chat**: Communicate with others in the same world

## Deployment

The project can be deployed to any static hosting service that supports Vite builds:

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting service
3. Ensure environment variables are set in your hosting platform

For Supabase Edge Functions, deploy using:
```sh
supabase functions deploy github-heatmap
```