import React from "react";
import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <TopBar />
      <main className="page-container pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
