import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TARGET_HOUSEHOLD_ID = "ad465329-34a8-43a8-8b89-198de2d0cec4";

function readBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "此一次性匯入工具只允許在本機開發環境使用。" }, { status: 404 });
  }

  const accessToken = readBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "缺少登入 session，請先登入後再執行匯入。" }, { status: 401 });
  }

  try {
    const { importGoogleSheetPackage } = await import("@/lib/migration/google-sheet-importer");
    const result = await importGoogleSheetPackage(TARGET_HOUSEHOLD_ID, accessToken);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "匯入失敗"
      },
      { status: 500 }
    );
  }
}
