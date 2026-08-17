import { useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { BrandMark } from "./BrandMark";

type AuthMode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    const credentials = { email: email.trim(), password };
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Compte créé. Confirmez votre adresse depuis l’e-mail Supabase, puis connectez-vous.");
      setMode("signin");
    }
    setPending(false);
  };

  return (
    <main className="auth-screen">
      <Card className="auth-card">
        <CardHeader>
          <BrandMark />
          <CardTitle>{mode === "signin" ? "Retrouvez vos tâches" : "Créer votre compte"}</CardTitle>
          <CardDescription>
            Vos espaces sont synchronisés par Supabase et restent accessibles depuis TodoAI et ChatGPT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="auth-form" onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="auth-email">Adresse e-mail</FieldLabel>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vous@exemple.com"
                  aria-invalid={Boolean(error)}
                  required
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="auth-password">Mot de passe</FieldLabel>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  aria-invalid={Boolean(error)}
                  required
                />
                <FieldDescription>8 caractères minimum.</FieldDescription>
                <FieldError>{error}</FieldError>
              </Field>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Connexion…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
              </Button>
            </FieldGroup>
          </form>
          {message ? (
            <Alert className="auth-alert">
              <AlertTitle>Dernière étape</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <span>{mode === "signin" ? "Première utilisation ?" : "Vous avez déjà un compte ?"}</span>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setMode((current) => current === "signin" ? "signup" : "signin");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signin" ? "Créer un compte" : "Se connecter"}
          </Button>
        </CardFooter>
      </Card>
      <p className="auth-footnote">Compte privé · données chiffrées en transit · aucune clé secrète stockée dans l’application</p>
    </main>
  );
}
