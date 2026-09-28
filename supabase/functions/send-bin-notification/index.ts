import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    /*
     * =====================================================
     * GET DATABASE WEBHOOK PAYLOAD
     * =====================================================
     */

    const payload = await req.json();

    console.log(
      "WEBHOOK PAYLOAD:",
      JSON.stringify(payload)
    );

    /*
     * Supabase Database Webhook sends
     * the updated row inside "record".
     */

    const bin = payload.record;

    if (!bin) {
      console.error(
        "NO RECORD FOUND IN WEBHOOK PAYLOAD"
      );

      return new Response(
        JSON.stringify({
          error: "No record found",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const {
      bin_id,
      current_level,
      waste_type,
    } = bin;

    console.log(
      "BIN ID:",
      bin_id
    );

    console.log(
      "CURRENT LEVEL:",
      current_level
    );

    console.log(
      "WASTE TYPE:",
      waste_type
    );

    /*
     * =====================================================
     * CHECK REQUIRED DATA
     * =====================================================
     */

    if (
      !bin_id ||
      current_level === undefined
    ) {
      console.error(
        "BIN ID OR CURRENT LEVEL MISSING"
      );

      return new Response(
        JSON.stringify({
          error:
            "bin_id and current_level are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * =====================================================
     * ONLY NOTIFY WHEN BIN REACHES 90%
     * =====================================================
     */

    if (current_level < 90) {
      console.log(
        "BIN BELOW 90%. NO PUSH NOTIFICATION."
      );

      return new Response(
        JSON.stringify({
          message:
            "Bin is below notification threshold",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(
      "BIN REACHED 90% OR HIGHER."
    );

    /*
     * =====================================================
     * GET REGISTERED PUSH TOKENS
     * =====================================================
     */

    const {
      data: tokens,
      error: tokenError,
    } = await supabase
      .from("push_tokens")
      .select(
        "user_id, expo_push_token"
      );

    if (tokenError) {
      console.error(
        "ERROR FETCHING PUSH TOKENS:",
        tokenError.message
      );

      return new Response(
        JSON.stringify({
          error:
            tokenError.message,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    /*
     * =====================================================
     * NO TOKENS
     * =====================================================
     */

    if (
      !tokens ||
      tokens.length === 0
    ) {
      console.log(
        "NO PUSH TOKENS FOUND"
      );

      return new Response(
        JSON.stringify({
          message:
            "No registered push tokens",
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    console.log(
      "PUSH TOKENS FOUND:",
      tokens.length
    );

    /*
     * =====================================================
     * CREATE EXPO PUSH MESSAGES
     * =====================================================
     */

    const messages = tokens
      .filter(
        (row: {
          user_id: string;
          expo_push_token: string;
        }) =>
          row.expo_push_token &&
          row.expo_push_token.startsWith(
            "ExponentPushToken"
          )
      )
      .map(
        (row: {
          user_id: string;
          expo_push_token: string;
        }) => ({
          to: row.expo_push_token,

          sound: "default",

          title:
            "OmniBin Alert",

          body:
            `${waste_type || "Waste"} bin has reached ` +
            `${current_level}%. Please collect bin now.`,

          data: {
            bin_id,
            waste_type,
            level: current_level,
          },
        })
      );

    /*
     * =====================================================
     * CHECK VALID TOKENS
     * =====================================================
     */

    if (
      messages.length === 0
    ) {
      console.log(
        "NO VALID EXPO PUSH TOKENS"
      );

      return new Response(
        JSON.stringify({
          message:
            "No valid Expo push tokens",
        }),
        {
          status: 200,
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    console.log(
      "SENDING PUSH NOTIFICATIONS:",
      messages.length
    );

    /*
     * =====================================================
     * SEND TO EXPO PUSH SERVICE
     * =====================================================
     */

    const expoResponse =
      await fetch(
        "https://exp.host/--/api/v2/push/send",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(messages),
        }
      );

    const expoResult =
      await expoResponse.json();

    console.log(
      "EXPO RESPONSE:",
      JSON.stringify(
        expoResult
      )
    );

    /*
     * =====================================================
     * SAVE NOTIFICATION RECORD
     * =====================================================
     */

    const {
      error:
        notificationError,
    } = await supabase
      .from("notification")
      .insert({
        bin_id,

        message:
          "Bin requires collection.",

        is_read: false,
      });

    if (
      notificationError
    ) {
      console.error(
        "ERROR SAVING NOTIFICATION:",
        notificationError.message
      );
    } else {
      console.log(
        "NOTIFICATION RECORD SAVED"
      );
    }

    /*
     * =====================================================
     * RETURN SUCCESS
     * =====================================================
     */

    return new Response(
      JSON.stringify({
        success: true,

        message:
          "Push notification sent",

        expo:
          expoResult,
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );

  } catch (error) {

    console.error(
      "SEND BIN NOTIFICATION ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});