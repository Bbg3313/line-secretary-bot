"use server";

import { revalidatePath } from "next/cache";

/** 담당자/상태 저장 후 대시보드 데이터 갱신용 */
export async function revalidateDashboard() {
  revalidatePath("/");
}
