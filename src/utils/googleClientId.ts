// Set via VITE_GOOGLE_CLIENT_ID in the frontend's .env — must be the same OAuth client as the
// server's GOOGLE_CLIENT_ID (see server/.env.example for how to create one). Empty until then;
// every Google sign-in entry point checks this and hides itself rather than rendering a button
// that can't actually work.
export const GOOGLE_CLIENT_ID: string = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";
