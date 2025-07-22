// src/components/CandlestickChart.jsx

import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export const CandlestickChart = ({ data }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Initialize chart
    if (!chartRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: "#1a1a1a" },
          textColor: "rgba(255, 255, 255, 0.9)",
        },
        grid: {
          vertLines: { color: "#333" },
          horzLines: { color: "#333" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candleSeries = chartRef.current.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderDownColor: "#ef5350",
        borderUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        wickUpColor: "#26a69a",
      });

      const formattedData = data.map((d) => ({
        time: d.timestamp / 1000,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
      }));

      candleSeries.setData(formattedData);
      chartRef.current.timeScale().fitContent();
    }

    // Handle window resizing
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data]);

  return <div ref={chartContainerRef} style={{ position: "relative" }} />;
};
