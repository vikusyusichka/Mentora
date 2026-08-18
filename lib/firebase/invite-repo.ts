import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { Invite, InviteWithCode } from "@/lib/invite";

/**
 * Коди, які видав цей учень. Читання живе під правилами (`createdBy`),
 * а створення й погашення — виключно на сервері: код дає доступ до
 * навчального звʼязку.
 */
export function subscribeMyInvites(
  studentUid: string,
  onChange: (invites: InviteWithCode[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "invites"),
      where("createdBy", "==", studentUid),
      orderBy("createdAt", "desc"),
      limit(20)
    ),
    (snapshot) => {
      onChange(
        snapshot.docs.map((snap) => ({
          code: snap.id,
          ...(snap.data() as Invite),
        }))
      );
    },
    onError
  );
}

export async function requestInvite(
  idToken: string,
  enrollmentId: string
): Promise<{ ok: boolean; code?: string; error?: string }> {
  const response = await fetch("/api/invites", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ enrollmentId }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
  };

  return response.ok
    ? { ok: true, code: data.code }
    : { ok: false, error: data.error ?? "Не вдалося створити код." };
}

export async function redeemInviteCode(
  idToken: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("/api/invites/redeem", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ code }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };

  return response.ok
    ? { ok: true }
    : { ok: false, error: data.error ?? "Не вдалося приєднатися." };
}
