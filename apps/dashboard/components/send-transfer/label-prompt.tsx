import { cn } from "@/lib/utils";
import { Tag, Check, Loader2, LogIn, AlertCircle } from "lucide-react";

interface LabelPromptProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onSkip: () => void;
  isSaving: boolean;
}

export function LabelPrompt({
  value,
  onChange,
  onSave,
  onSkip,
  isSaving,
}: LabelPromptProps) {
  return (
    <div className="mt-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-neutral-500" />
        <p className="text-sm font-medium text-neutral-700">
          save this contact?
        </p>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Add a label to easily find this address next time
      </p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., alice, rent, savings"
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm mb-3 focus:outline-none focus:border-vibrant-red"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          skip
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim() || isSaving}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-1",
            value.trim()
              ? "bg-vibrant-red text-white hover:bg-vibrant-red/90 cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
          )}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          save
        </button>
      </div>
    </div>
  );
}

interface SignInPromptProps {
  error: string | null;
  isReauthenticating: boolean;
  canReauth: boolean;
  onSignIn: () => void;
  onCancel: () => void;
}

export function SignInPrompt({
  error,
  isReauthenticating,
  canReauth,
  onSignIn,
  onCancel,
}: SignInPromptProps) {
  return (
    <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
      <div className="flex items-center gap-2 mb-3">
        <LogIn className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-medium text-amber-800">
          sign in to use contacts
        </p>
      </div>
      <p className="text-xs text-amber-700 mb-3">
        Your session has expired. Sign in again to save and view your contacts.
      </p>
      {error && (
        <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 text-sm text-neutral-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
        >
          cancel
        </button>
        <button
          type="button"
          onClick={onSignIn}
          disabled={isReauthenticating || !canReauth}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-1",
            canReauth && !isReauthenticating
              ? "bg-vibrant-red text-white hover:bg-vibrant-red/90 cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
          )}
        >
          {isReauthenticating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LogIn className="h-3 w-3" />
          )}
          {isReauthenticating ? "signing in..." : "sign in"}
        </button>
      </div>
    </div>
  );
}
