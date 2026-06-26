"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/tables/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COMPONENT_CATEGORY_LABEL } from "@/lib/labels";
import { formatNumber, formatVnd } from "@/lib/utils";
import { useInventoryValue } from "@/features/inventory/hooks";

export default function InventoryValuePage() {
  const { data, isLoading, isError } = useInventoryValue();

  return (
    <div>
      <PageHeader title="Giá trị kho" description="Tổng giá vốn tồn kho" />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : isError || !data ? (
        <EmptyState title="Không tải được số liệu" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>Tổng giá trị</CardDescription>
              <CardTitle className="text-3xl">{formatVnd(data.totalValue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Theo loại linh kiện</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead className="text-right">Giá trị</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCategory.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell>{COMPONENT_CATEGORY_LABEL[row.category]}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.count)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatVnd(row.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
