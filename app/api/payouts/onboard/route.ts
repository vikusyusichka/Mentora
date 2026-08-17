export const runtime = "nodejs";

async function authorizeTutor(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { error: "Потрібно увійти в акаунт.", status: 401 } as const;

  const { adminAuth } = await import("@/lib/firebase/admin");
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.role !== "tutor") {
      return {
        error: "Отримувати виплати можуть лише репетитори.",
        status: 403,
      } as const;
    }
    return { decoded } as const;
  } catch {
    return { error: "Недійсний токен.", status: 401 } as const;
  }
}

/**
 * Стан виплат. Провайдер не повідомляє про завершення онбордингу
 * окремим вебхуком у нашому потоці, тож стан перечитуємо тоді, коли він
 * потрібен: коли репетитор повернувся з анкети.
 */
export async function GET(request: Request) {
  const auth = await authorizeTutor(request);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    const { providerById } = await import("@/lib/payments");

    const profileRef = adminDb().doc(`tutorProfiles/${auth.decoded.uid}`);
    const snap = await profileRef.get();
    const accountId = snap.get("payoutAccountId") as string | undefined;
    const providerId = snap.get("payoutProvider") as
      | "stripe"
      | "wayforpay"
      | undefined;

    if (!accountId || !providerId) {
      return Response.json({ connected: false, payoutsEnabled: false });
    }

    const payoutsEnabled = await providerById(providerId).canAcceptPayments(
      accountId
    );
    await profileRef.set({ payoutsEnabled }, { merge: true });

    return Response.json({ connected: true, payoutsEnabled, provider: providerId });
  } catch (err) {
    console.error("[payouts/status]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Онбординг репетитора у платіжного провайдера.
 *
 * `payoutAccountId` пише виключно сервер — Security Rules забороняють
 * клієнту навіть згадувати це поле. Інакше репетитор міг би підставити
 * чужий рахунок і отримувати чужі гроші.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    return Response.json({ error: "Потрібно увійти в акаунт." }, { status: 401 });
  }

  try {
    const { adminAuth, adminDb } = await import("@/lib/firebase/admin");
    const { providerById, DEFAULT_PROVIDER } = await import("@/lib/payments");

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Недійсний токен." }, { status: 401 });
    }

    if (decoded.role !== "tutor") {
      return Response.json(
        { error: "Отримувати виплати можуть лише репетитори." },
        { status: 403 }
      );
    }

    const db = adminDb();
    const profileRef = db.doc(`tutorProfiles/${decoded.uid}`);
    const snap = await profileRef.get();

    if (!snap.exists) {
      return Response.json(
        { error: "Спершу заповніть профіль репетитора." },
        { status: 400 }
      );
    }

    const existingAccountId = snap.get("payoutAccountId") as string | undefined;
    const providerId =
      (snap.get("payoutProvider") as "stripe" | "wayforpay" | undefined) ??
      DEFAULT_PROVIDER;
    const provider = providerById(providerId);

    const origin = new URL(request.url).origin;
    const { url, accountId } = await provider.onboardTutor({
      tutorId: decoded.uid,
      email: decoded.email,
      existingAccountId,
      returnUrl: `${origin}/tutor/payouts?status=done`,
      refreshUrl: `${origin}/tutor/payouts?status=refresh`,
    });

    // Акаунт зберігаємо одразу: інакше перерваний онбординг лишав би
    // «висячий» акаунт у провайдера, і наступна спроба створювала б новий.
    await profileRef.set(
      {
        payoutAccountId: accountId,
        payoutProvider: providerId,
        payoutsEnabled: false,
      },
      { merge: true }
    );

    return Response.json({ url });
  } catch (err) {
    console.error("[payouts/onboard]", err);
    const message =
      err instanceof Error ? err.message : "Невідома помилка сервера.";
    return Response.json({ error: message }, { status: 500 });
  }
}
