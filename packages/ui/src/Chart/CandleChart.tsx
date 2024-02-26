import type {
  LpPriceOhlcDataFormatted,
  ChartType,
  ChartHeight,
  VolumeData,
  OraclePriceData,
  LlammaLiquididationRange,
} from './types'
import type { IChartApi, Time } from 'lightweight-charts'

import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

type Props = {
  chartType: ChartType
  chartHeight: ChartHeight
  ohlcData: LpPriceOhlcDataFormatted[]
  volumeData?: VolumeData[]
  oraclePriceData?: OraclePriceData[]
  liquidationRange?: LlammaLiquididationRange
  timeOption: string
  wrapperRef: any
  chartExpanded?: boolean
  magnet: boolean
  colors: {
    backgroundColor: string
    lineColor: string
    textColor: string
    areaTopColor: string
    areaBottomColor: string
    chartGreenColor: string
    chartRedColor: string
    chartLabelColor: string
    chartVolumeRed: string
    chartVolumeGreen: string
    chartOraclePrice: string
    rangeColor: string
    rangeColorA25: string
  }
  refetchingHistory: boolean
  refetchingCapped: boolean
  lastRefetchLength: number
  fetchMoreChartData: () => void
}

const CandleChart = ({
  chartType,
  chartHeight,
  ohlcData,
  volumeData,
  oraclePriceData,
  liquidationRange,
  timeOption,
  wrapperRef,
  chartExpanded,
  magnet,
  colors,
  refetchingHistory,
  refetchingCapped,
  lastRefetchLength,
  fetchMoreChartData,
}: Props) => {
  const chartContainerRef = useRef(null)
  const chartRef = useRef<IChartApi | null>(null)

  const [chartCreated, setChartCreated] = useState(false)
  const [isUnmounting, setIsUnmounting] = useState(false)
  const [lastTimescale, setLastTimescale] = useState<{ from: Time; to: Time } | null>(null)

  useEffect(() => {
    if (chartCreated && !ohlcData) return

    if (chartContainerRef.current) {
      chartRef.current = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: colors.backgroundColor },
          textColor: colors.textColor,
        },
        width: wrapperRef.current.clientWidth,
        height: chartExpanded ? chartHeight.expanded : chartHeight.standard,
        timeScale: {
          timeVisible: timeOption === 'day' ? false : true,
        },
        rightPriceScale: {
          autoScale: true,
          alignLabels: true,
          borderVisible: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        grid: {
          vertLines: {
            visible: false,
          },
          horzLines: {
            visible: false,
          },
        },
        crosshair: {
          mode: magnet ? CrosshairMode.Magnet : CrosshairMode.Normal,
          vertLine: {
            width: 4,
            color: '#C3BCDB44',
            style: LineStyle.Solid,
            labelBackgroundColor: '#9B7DFF',
          },
          horzLine: {
            color: '#9B7DFF',
            labelBackgroundColor: '#9B7DFF',
          },
        },
      })
      chartRef.current.timeScale()

      let totalDecimalPlaces = 4

      if (liquidationRange !== undefined) {
        const areaSeries1 = chartRef.current.addAreaSeries({
          topColor: colors.rangeColorA25,
          bottomColor: colors.rangeColorA25, // semi-transparent color
          lineColor: colors.rangeColor, // transparent color
          lineWidth: 1,
          lineStyle: 3,
          crosshairMarkerVisible: false,
          pointMarkersVisible: false,
          priceLineVisible: false,
        })

        const areaSeries2 = chartRef.current.addAreaSeries({
          topColor: colors.backgroundColor, // transparent color
          bottomColor: colors.backgroundColor, // transparent color
          lineColor: colors.rangeColor, // transparent color
          lineWidth: 1,
          lineStyle: 3,
          crosshairMarkerVisible: false,
          pointMarkersVisible: false,
          priceLineVisible: false,
        })

        areaSeries1.setData(liquidationRange.price1)
        areaSeries2.setData(liquidationRange.price2)
      }

      if (volumeData !== undefined) {
        const volumeSeries = chartRef.current.addHistogramSeries({
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '', // set as an overlay by setting a blank priceScaleId
        })
        volumeSeries.priceScale().applyOptions({
          // set the positioning of the volume series
          scaleMargins: {
            top: 0.7, // highest point of the series will be 70% away from the top
            bottom: 0,
          },
        })

        volumeSeries.setData(volumeData)
      }

      const candlestickSeries = chartRef.current.addCandlestickSeries({
        priceLineStyle: 3,
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceFormat: {
          type: 'custom',
          formatter: (price: any) => {
            let [whole, fraction] = price.toString().split('.')

            if (!fraction) {
              return price.toFixed(4)
            }

            let nonZeroIndex = fraction.split('').findIndex((char: any) => char !== '0')

            // If the price is less than 1, then there will be 4 decimal places after the first non-zero digit.
            // If the price is greater than or equal to 1, there will be 4 decimal places after the decimal point.
            totalDecimalPlaces = price >= 1 ? 4 : nonZeroIndex + 4

            return price.toFixed(totalDecimalPlaces)
          },
          minMove: 0.0000001,
        },
      })

      candlestickSeries.setData(ohlcData)

      if (oraclePriceData !== undefined) {
        const lineSeries = chartRef.current.addLineSeries({
          color: colors.chartOraclePrice,
          lineWidth: 2,
          priceLineStyle: 3,
        })

        lineSeries.setData(oraclePriceData)
      }

      setChartCreated(true)

      const timeScale = chartRef.current.timeScale()

      if (lastTimescale) {
        timeScale.setVisibleRange(lastTimescale)
      }

      let timer: NodeJS.Timeout | null = null
      timeScale.subscribeVisibleLogicalRangeChange(() => {
        if (timer !== null || refetchingHistory || refetchingCapped || lastRefetchLength === ohlcData.length) {
          return
        }
        timer = setTimeout(() => {
          const logicalRange = timeScale.getVisibleLogicalRange()
          if (
            logicalRange !== null &&
            (!refetchingHistory || !refetchingCapped || lastRefetchLength !== ohlcData.length)
          ) {
            const barsInfo = candlestickSeries.barsInLogicalRange(logicalRange)
            if (barsInfo !== null && barsInfo.barsBefore < 50) {
              setLastTimescale(timeScale.getVisibleRange())
              fetchMoreChartData()
            }
          }
          timer = null
        }, 150)
      })

      return () => {
        if (timer !== null) {
          clearTimeout(timer) // Clear any pending timer when the component unmounts or before re-subscribing.
        }

        chartRef.current?.remove()
      }
    }
  }, [
    ohlcData,
    colors,
    timeOption,
    chartCreated,
    wrapperRef,
    chartExpanded,
    magnet,
    chartType,
    chartHeight.expanded,
    chartHeight.standard,
    fetchMoreChartData,
    refetchingHistory,
    refetchingCapped,
    lastRefetchLength,
    lastTimescale,
    volumeData,
    oraclePriceData,
  ])

  useEffect(() => {
    wrapperRef.current = new ResizeObserver((entries) => {
      if (isUnmounting) return // Skip resizing if the component is unmounting

      let { width, height } = entries[0].contentRect
      width -= 1
      if (width <= 0) return // Skip resizing if the width is negative or zero

      chartRef.current?.applyOptions({ width, height })
      chartRef.current?.timeScale().getVisibleLogicalRange()
    })

    wrapperRef.current.observe(chartContainerRef.current)

    return () => {
      setIsUnmounting(true)
      wrapperRef?.current && wrapperRef.current.disconnect()
    }
  }, [wrapperRef, isUnmounting])

  return <Container ref={chartContainerRef} />
}

const Container = styled.div`
  position: absolute;
  width: 100%;
`

export default CandleChart
