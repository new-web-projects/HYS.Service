import { requireUser } from "@/lib/auth-guard";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const user = await requireUser();
  const { conversationId } = await params;

  return (
    <main className="mx-auto flex h-[calc(100vh-0px)] max-w-2xl flex-col sm:h-[85vh] sm:border sm:border-border sm:rounded-xl sm:my-6">
      <ChatWindow conversationId={conversationId} viewerId={user.id} />
    </main>
  );
}