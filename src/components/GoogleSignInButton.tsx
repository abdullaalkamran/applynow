import { GoogleLogin } from "@react-oauth/google";
import { GOOGLE_CLIENT_ID } from "../utils/googleClientId";

/** Renders Google's own button when a real OAuth client is configured, and a plain disabled-looking
 * placeholder otherwise — so Login/Signup never has to know whether Google sign-in is wired up yet. */
export function GoogleSignInButton({ onCredential, onError }: { onCredential: (credential: string) => void; onError: () => void }) {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div
        title="Set VITE_GOOGLE_CLIENT_ID (and the server's GOOGLE_CLIENT_ID) to enable this"
        className="w-full rounded-xl border border-dashed border-slate-200 px-3.5 py-2.5 text-center text-[12.5px] text-slate-400"
      >
        Google sign-in not configured yet
      </div>
    );
  }

  return (
    <div className="flex justify-center [&>div]:w-full">
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) onCredential(credentialResponse.credential);
          else onError();
        }}
        onError={onError}
        width="320"
      />
    </div>
  );
}
