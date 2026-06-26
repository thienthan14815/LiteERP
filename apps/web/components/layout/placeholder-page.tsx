import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  message?: string;
}

export function PlaceholderPage({
  title,
  description,
  message = "Tính năng này thuộc Phase tiếp theo.",
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          {message}
        </CardContent>
      </Card>
    </div>
  );
}
