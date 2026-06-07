"use client";



/**

 * Grafik bar arus kas — masuk vs keluar per hari.

 */

import { Bar, BarChart, CartesianGrid, Legend, XAxis } from "recharts";

import {

  ChartContainer,

  ChartLegendContent,

  ChartTooltip,

  ChartTooltipContent,

  type ChartConfig,

} from "@/components/ui/chart";
import { EmptyState } from "@/components/empty-state";

import {

  Card,

  CardContent,

  CardDescription,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

import type { RingkasanHarian } from "@/types/database";

import { formatBulan } from "@/lib/format";

import { chartTooltipRupiahRow } from "@/lib/chart-tooltip";

import { Skeleton } from "@/components/ui/skeleton";



const chartConfig = {

  total_masuk: { label: "Masuk", color: "var(--chart-1)" },

  total_keluar: { label: "Keluar", color: "var(--chart-2)" },

} satisfies ChartConfig;



interface CashflowChartProps {
  data: RingkasanHarian[];
  loading: boolean;
  periodeLabel: string;
}

export function CashflowChart({ data, loading, periodeLabel }: CashflowChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatBulan(d.tanggal),

    total_masuk: Number(d.total_masuk),

    total_keluar: Number(d.total_keluar),

  }));



  const hasData = chartData.some(

    (d) => d.total_masuk > 0 || d.total_keluar > 0

  );



  return (

    <Card>

      <CardHeader>

        <CardTitle>Arus kas bulanan</CardTitle>
        <CardDescription>
          {periodeLabel} — perbandingan uang masuk dan keluar
        </CardDescription>

      </CardHeader>

      <CardContent>

        {loading ? (

          <Skeleton className="h-[280px] w-full" />

        ) : !hasData ? (

          <EmptyState
            variant="inset"
            title="Belum ada data"
            description="Belum ada transaksi pada periode ini."
          />

        ) : (

          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full sm:h-[300px]">

            <BarChart data={chartData} accessibilityLayer margin={{ left: 4, right: 4, bottom: 8 }}>

              <CartesianGrid vertical={false} />

              <XAxis

                dataKey="label"

                tickLine={false}

                axisLine={false}

                tickMargin={8}

                fontSize={11}

                interval="preserveStartEnd"

              />

              <ChartTooltip

                content={

                  <ChartTooltipContent

                    labelFormatter={(_, payload) =>

                      payload?.[0]?.payload?.label ?? ""

                    }

                    formatter={(value, name, item) =>

                      chartTooltipRupiahRow(value, name, item, chartConfig)

                    }

                  />

                }

              />

              <Legend content={<ChartLegendContent />} />

              <Bar

                dataKey="total_masuk"

                name="total_masuk"

                fill="var(--color-total_masuk)"

                radius={4}

              />

              <Bar

                dataKey="total_keluar"

                name="total_keluar"

                fill="var(--color-total_keluar)"

                radius={4}

              />

            </BarChart>

          </ChartContainer>

        )}

      </CardContent>

    </Card>

  );

}


