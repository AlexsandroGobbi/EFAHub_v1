import { notFound } from "next/navigation";
import EfaHubApp from "@/components/efahub-app";
import { parseWorkspaceRoute, staticWorkspacePaths } from "@/lib/routes";

type PageProps = {
  params: Promise<{ area: string; segments?: string[] }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return staticWorkspacePaths.map((path) => {
    const [area, ...segments] = path.slice(1).split("/");
    return { area, segments };
  });
}

export default async function WorkspacePage({ params }: PageProps) {
  const { area, segments = [] } = await params;
  const route = parseWorkspaceRoute(area, segments);

  if (!route) notFound();

  return (
    <EfaHubApp
      initialRole={route.role}
      initialView={route.view}
      initialBookingStep={route.bookingStep}
      initialBusinessId={route.businessId}
    />
  );
}
