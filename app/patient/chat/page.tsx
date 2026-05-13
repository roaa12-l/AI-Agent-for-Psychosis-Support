import { ChatThread } from "@/components/chat/chat-thread";
import { heroConversation, type ChatTurn } from "@/lib/min-jun";

/**
 * Patient chat surface. Server component; defers all interactivity to
 * <ChatThread>, which manages the live conversation against /api/respond.
 *
 * - Default: starts empty so the user can drive the conversation.
 * - ?demo=true: seeds the thread with the canned workplace-paranoia
 *   episode so demo videos record predictably without depending on live
 *   API timing.
 */
export default async function PatientChatPage(
  props: PageProps<"/patient/chat">
) {
  const searchParams = await props.searchParams;
  const demoParam = searchParams?.demo;
  const isDemo =
    demoParam === "true" || demoParam === "1" || demoParam === "";

  const initial: ChatTurn[] = isDemo ? [...heroConversation] : [];

  return <ChatThread initial={initial} />;
}
