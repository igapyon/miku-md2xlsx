# Book: chart-mixed-sample01.xlsx

## Sheet: chart-mixed

**複合グラフサンプル**

### Table: 001 (B3-E8)

| **項目** | **売上** | **割引額** | **利益率** |
| --- | --- | --- | --- |
| 2024年 | 13,568 | 1,000 | 25% |
| 2025年 | 19,287 | 1,200 | 27% |
| 2026年 | 25,051 | 1,500 | 32% |
| 2027年 | 28,053 | 2,300 | 25% |
| 2028年 | 31,027 | 2,500 | 18% |


### Chart: 001 (B10)
- Title: 棒と折れ線
- Type: Bar Chart + Line Chart (Combined)
- Series:
  - 売上
    - categories: 'chart-mixed'!$B$4:$B$8
    - values: 'chart-mixed'!$C$4:$C$8
  - 割引額
    - categories: 'chart-mixed'!$B$4:$B$8
    - values: 'chart-mixed'!$D$4:$D$8
  - 利益率
    - Axis: secondary
    - categories: 'chart-mixed'!$B$4:$B$8
    - values: 'chart-mixed'!$E$4:$E$8


