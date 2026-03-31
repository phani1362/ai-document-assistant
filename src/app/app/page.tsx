import { ChatWindow } from "@/components/ChatWindow";
import { LogoutButton } from "@/components/LogoutButton";

export default function AppPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-700">
            AI Document Assistant
          </p>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Upload a text document and ask grounded questions
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              This project is protected with access control for portfolio
              showcasing.
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>
      <ChatWindow />
    </main>
  );
}
