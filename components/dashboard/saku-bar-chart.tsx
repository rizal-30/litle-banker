"use client";



import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {

  ChartContainer,

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

import type { SaldoSaku } from "@/types/database";

import { chartTooltipRupiahRow } from "@/lib/chart-tooltip";

import { Skeleton } from "@/components/ui/skeleton";



const chartConfig = {

  saldo: { label: "Saldo", color: "var(--chart-3)" },

} satisfies ChartConfig;



interface SakuBarChartProps {

  data: SaldoSaku[];

  loading: boolean;

}



export function SakuBarChart({ data, loading }: SakuBarChartProps) {

  const chartData = data.map((d) => ({

    nama: d.nama,

    saldo: Number(d.saldo),

  }));



  return (

    <Card className="lg:col-span-2">

      <CardHeader>

        <CardTitle>Saldo per saku</CardTitle>

        <CardDescription>Distribusi uang di setiap saku</CardDescription>

      </CardHeader>

      <CardContent>

        {loading ? (

          <Skeleton className="h-[280px] w-full" />

        ) : chartData.length === 0 ? (

          <EmptyState
            variant="inset"
            title="Belum ada saku"
            description="Tambahkan saku di menu Saku untuk melihat grafik saldo."
          />

        ) : (

          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full sm:h-[280px]">

            <BarChart

              data={chartData}

              layout="vertical"

              accessibilityLayer

              margin={{ left: 8, right: 16 }}

            >

              <CartesianGrid horizontal={false} />

              <YAxis

                dataKey="nama"

                type="category"

                tickLine={false}

                axisLine={false}

                width={80}

                fontSize={11}

              />

              <XAxis type="number" hide />

              <ChartTooltip

                content={

                  <ChartTooltipContent

                    labelFormatter={(_, payload) =>

                      payload?.[0]?.payload?.nama ?? ""

                    }

                    formatter={(value, name, item) =>

                      chartTooltipRupiahRow(value, name, item, chartConfig)

                    }

                  />

                }

              />

              <Bar

                dataKey="saldo"

                name="saldo"

                fill="var(--color-saldo)"

                radius={4}

              />

            </BarChart>

          </ChartContainer>

        )}

      </CardContent>

    </Card>

  );

}


