# LineStart - Production Scheduling System

A web-based production scheduling system for manufacturing environments built with SvelteKit and Firebase.

## Project Status

**Task 01: Firebase Setup** - ✅ **COMPLETE**

### Completed
- ✅ SvelteKit project initialized with Svelte 5 and TypeScript
- ✅ All frontend dependencies installed (305 packages)
- ✅ TailwindCSS configured
- ✅ Firebase Functions directory structure created
- ✅ Firebase Functions dependencies installed (237 packages)
- ✅ Firebase configuration files created and configured
- ✅ Firestore security rules implemented (firestore.rules)
- ✅ Firestore indexes configured (firestore.indexes.json)
- ✅ Project directory structure established
- ✅ Firebase config values applied
- ✅ Functions build verified

**Ready for Task 02: Data Models**

## Project Structure

```
LineStart/
├── src/
│   ├── lib/
│   │   ├── components/     # Svelte components (to be built)
│   │   ├── stores/         # Svelte stores for state management (to be built)
│   │   ├── types/          # TypeScript interfaces and types (to be built)
│   │   ├── utils/          # Utility functions (to be built)
│   │   └── firebase.ts     # Firebase initialization
│   ├── routes/
│   │   ├── +layout.svelte  # Root layout with Tailwind CSS
│   │   └── +page.svelte    # Home page
│   ├── app.css             # Tailwind directives
│   └── app.html            # HTML template
├── functions/
│   ├── src/
│   │   └── index.ts        # Cloud Functions (to be implemented in Task 09)
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── SPEC.md             # Technical specification
│   ├── DESIGN_DECISIONS.md # Design decisions documentation
│   └── FUTURE_FEATURES.md  # Deferred features
├── firebase.json           # Firebase project configuration
├── .firebaserc             # Firebase project aliases
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
├── tailwind.config.js      # Tailwind CSS configuration
├── svelte.config.js        # SvelteKit configuration
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Project dependencies
└── CLAUDE.md               # Development instructions

```

## Tech Stack

- **Framework**: SvelteKit with Svelte 5 (using runes)
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS
- **Backend**: Firebase (Auth, Firestore, Functions, Hosting, FCM)
- **Build Tool**: Vite

## Available Scripts

```bash
# Development
npm run dev              # Start dev server

# Build
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run check            # Type-check with svelte-check
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
```

## Next Steps

**Task 01 is complete!** You can now:

1. Start the development server: `npm run dev`
2. Proceed to **Task 02: Data Models** (create TypeScript interfaces in `src/lib/types/index.ts`)
3. When ready to deploy:
   - Deploy security rules: `firebase deploy --only firestore:rules`
   - Deploy indexes: `firebase deploy --only firestore:indexes`
   - Deploy functions: `firebase deploy --only functions` (after implementing in Task 09)
   - Deploy hosting: `firebase deploy --only hosting` (after building features)

## Documentation

- Full specification: [docs/SPEC.md](docs/SPEC.md)
- Development guide: [CLAUDE.md](CLAUDE.md)
- Design decisions: [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md)
- Future features: [docs/FUTURE_FEATURES.md](docs/FUTURE_FEATURES.md)

## Firebase Configuration Required

Before deploying or running the app, you need to:

1. Update `.firebaserc` with your Firebase project ID
2. Update `src/lib/firebase.ts` with your Firebase web app configuration
3. Install Firebase CLI globally: `npm install -g firebase-tools`
4. Login to Firebase: `firebase login`
5. Install functions dependencies: `cd functions && npm install`

Once configured, you can:
- Deploy security rules: `firebase deploy --only firestore:rules`
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Deploy functions: `firebase deploy --only functions`
- Deploy hosting: `firebase deploy --only hosting`
