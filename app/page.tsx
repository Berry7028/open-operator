import { Suspense } from "react";
import ClientApp from "./components/ClientApp";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ClientApp />
    </Suspense>
  );
}