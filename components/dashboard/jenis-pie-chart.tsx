"use client";



import { Cell, Legend, Pie, PieChart } from "recharts";

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

import type { RingkasanJenis, JenisTransaksi } from "@/types/database";

import { JENIS_TRANSAKSI_LABEL } from "@/types/database";

import { JENIS_TRANSAKSI_CHART_COLOR } from "@/lib/jenis-transaksi-style";

import { Skeleton } from "@/components/ui/skeleton";

import { chartTooltipRupiahRow } from "@/lib/chart-tooltip";



interface JenisPieChartProps {
  data: RingkasanJenis[];
  loading: boolean;
  periodeLabel: string;
}

export function JenisPieChart({ data, loading, periodeLabel }: JenisPieChartProps) {

  const chartData = data.map((d) => {

    const name = JENIS_TRANSAKSI_LABEL[d.jenis] ?? d.jenis;

    return {

      name,

      value: Number(d.total_jumlah),

      fill:
        JENIS_TRANSAKSI_CHART_COLOR[d.jenis as JenisTransaksi] ??
        "var(--chart-1)",

    };

  });



  const chartConfig = chartData.reduce(

    (acc, item) => {

      acc[item.name] = { label: item.name, color: item.fill };

      return acc;

    },

    {} as ChartConfig

  );



  return (

    <Card>

      <CardHeader>

        <CardTitle>Komposisi transaksi</CardTitle>

        <CardDescription>{periodeLabel} — per jenis transaksi</CardDescription>

      </CardHeader>

      <CardContent>

        {loading ? (

          <Skeleton className="mx-auto h-[280px] w-[280px] rounded-full" />

        ) : chartData.length === 0 ? (

          <EmptyState
            variant="inset"
            title="Belum ada data"
            description="Belum ada transaksi pada periode ini."
          />

        ) : (

          <ChartContainer

            config={chartConfig}

            className="aspect-auto mx-auto h-[240px] w-full max-w-[360px] sm:h-[300px]"

          >

            <PieChart>

              <ChartTooltip

                content={

                  <ChartTooltipContent

                    nameKey="name"

                    formatter={(value, name, item) =>

                      chartTooltipRupiahRow(value, name, item, chartConfig)

                    }

                  />

                }

              />

              <Legend content={<ChartLegendContent nameKey="name" />} />

              <Pie

                data={chartData}

                dataKey="value"

                nameKey="name"

                cx="50%"

                cy="45%"

                innerRadius={55}

                outerRadius={90}

              >

                {chartData.map((entry, index) => (

                  <Cell key={`cell-${index}`} fill={entry.fill} />

                ))}

              </Pie>

            </PieChart>

          </ChartContainer>

        )}

      </CardContent>

    </Card>

  );

}


