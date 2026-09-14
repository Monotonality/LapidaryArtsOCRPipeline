"use client";

import { useActionState } from "react";
import { setMemberStatus, type MemberStatusState } from "./actions";
import styles from "./team.module.css";

export function MemberToggle({
  userId,
  isDeleted,
}: {
  userId: string;
  isDeleted: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    MemberStatusState,
    FormData
  >(setMemberStatus.bind(null, userId, isDeleted ? "approved" : "deleted"), {});

  return (
    <div className={styles.toggleWrap}>
      {state?.error && (
        <span role="alert" className={styles.alertInline}>
          {state.error}
        </span>
      )}
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={isDeleted ? styles.reactivate : styles.deactivate}
        >
          {isDeleted ? "Reactivate" : "Deactivate"}
        </button>
      </form>
    </div>
  );
}