"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginActionState } from "./actions";

const initialState: LoginActionState = {
  status: "idle",
  message: ""
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(sendMagicLink, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="email">Email</label>
      <div className="auth-row">
        <input id="email" name="email" placeholder="you@example.com" type="email" required />
        <button disabled={isPending} type="submit">
          {isPending ? "寄送中" : "寄送登入連結"}
        </button>
      </div>
      {state.message ? <p className={`auth-message auth-${state.status}`}>{state.message}</p> : null}
    </form>
  );
}
