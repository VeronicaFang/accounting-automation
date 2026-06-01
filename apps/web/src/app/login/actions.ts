"use server";

import { requestMagicLink } from "@/lib/auth/supabase-auth";

export type LoginActionState = {
  status: "idle" | "sent" | "error";
  message: string;
};

export async function sendMagicLink(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return {
      status: "error",
      message: "請輸入有效的 email。"
    };
  }

  const result = await requestMagicLink(email);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message
    };
  }

  return {
    status: "sent",
    message: "登入連結已寄出。請到信箱開啟連結完成登入。"
  };
}
