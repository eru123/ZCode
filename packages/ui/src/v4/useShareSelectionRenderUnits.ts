import { useMemo } from "react";

import type { ConversationRow } from "@zcode/shared/zcode-protocol-v4";
import {
  buildConversationTurnRenderUnits,
  type ConversationTurnRenderUnit,
} from "@/v4/conversationTurnRenderUnits.js";

const EMPTY_ROWS: readonly ConversationRow[] = [];
const EMPTY_SHARE_SELECTION_RENDER_UNITS: ConversationTurnRenderUnit[] = [];

/**
 * 共享选择（partial share）专用的 render units 派生。
 *
 * 消费方（选择面板、底部 dock、timeline 选中高亮）全部由 shareActive / 面板可见性
 * 门控；普通会话中 rows.window 的引用随每个流式帧变化，SessionPane 若无条件重建，
 * 会与 ConversationTimeline 重复执行一次 O(rows) 的 unit 派生。未激活共享时固定返回
 * 模块级空数组：既跳过派生本身，也让下游 shareItems / eligibleShareItems 等 memo
 * 因引用稳定而不再逐帧重算。
 */
export function useShareSelectionRenderUnits(
  rowsWindow: readonly ConversationRow[] | undefined,
  shareActive: boolean,
): ConversationTurnRenderUnit[] {
  return useMemo(
    () =>
      shareActive
        ? buildConversationTurnRenderUnits(rowsWindow ?? EMPTY_ROWS)
        : EMPTY_SHARE_SELECTION_RENDER_UNITS,
    [rowsWindow, shareActive],
  );
}
