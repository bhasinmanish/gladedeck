import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an expert Pine Script v5 and ThinkScript developer.
When given a plain-English description of a trading alert or indicator, you output clean,
working script code — nothing else.

Rules:
- Default to Pine Script v5 unless the user specifies ThinkScript.
- Start Pine Script with: //@version=5
- For alerts, use alert() or alertcondition().
- Output only the code block, no markdown fences, no explanation.
- Keep code concise and idiomatic.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, language = "pine" } = await request.json();
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate ${language === "pine" ? "Pine Script v5" : "ThinkScript"} for: ${prompt}`,
        },
      ],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pine-script] Anthropic error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const code =
    message.content[0].type === "text" ? message.content[0].text : "";

  return NextResponse.json({ code });
}
