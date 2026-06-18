import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/consolidation-scoring")({
  beforeLoad: () => {
    throw redirect({ to: "/scoring" });
  },
});
