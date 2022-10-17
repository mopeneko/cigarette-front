import { mdiGithub, mdiLoading, mdiReload } from "@mdi/js";
import Icon from "@mdi/react";
import { ApexOptions } from "apexcharts";
import dayjs from "dayjs";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Address,
  MosaicId,
  NetworkRepository,
  Order,
  RepositoryFactoryHttp,
  Transaction as SymbolTransaction,
  TransactionGroup,
  TransactionRepository,
  TransferTransaction,
} from "symbol-sdk";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Transaction {
  hash: string;
  timestamp: dayjs.Dayjs;
}

interface Series {
  name: string;
  data: any[];
}

const Home: NextPage = () => {
  const [todayCount, setTodayCount] = useState(0);
  const [data, setData] = useState<number[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [countPerHour, setCountPerHour] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [heatmapSeries, setHeatmapSeries] = useState<Series[]>([]);

  /**
   * dailyOptions - 日次グラフのオプション
   */
  const dailyOptions: ApexOptions = {
    chart: {
      id: "basic-bar",
    },
    xaxis: {
      title: {
        text: "Counts",
      },
      categories: categories,
    },
  };

  /**
   * dailySeries - 日次グラフのシリーズ
   */
  const dailySeries: Series[] = [
    {
      name: "Count",
      data: data,
    },
  ];

  /**
   * perHourOption - 時間毎グラフのオプション
   */
  const perHourOptions: ApexOptions = {
    chart: {
      id: "basic-bar",
    },
    xaxis: {
      title: {
        text: "Counts per hour",
      },
      categories: [...Array(24)].map((_, i) => i),
    },
  };

  /**
   * perHourSeries - 時間毎グラフのシリーズ
   */
  const perHourSeries: Series[] = [
    {
      name: "Count",
      data: countPerHour,
    },
  ];

  /**
   * heatmapOptions - heatmap のオプション
   */
  const heatmapOptions: ApexOptions = {
    chart: {
      id: "heatmap",
    },
    xaxis: {
      title: {
        text: "Heatmap",
      },
      categories: [],
    },
  };

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /**
   * loadTransactions - トランザクションの読み込み
   */
  const loadTransactions = () => {
    (async () => {
      setLoadingCount((prev) => prev + 1);

      try {
        const repositoryFactory = new RepositoryFactoryHttp(
          "https://01.symbol-blockchain.com:3001"
        );
        const netRepo = repositoryFactory.createNetworkRepository();
        const txRepo = repositoryFactory.createTransactionRepository();
        const epochAdjustment = await fetchEpochAdjustment(netRepo);
        const transactions: Transaction[] = [];
        await fetchTransactions(txRepo, epochAdjustment)
        setTransactions(transactions);
        processTransactions(transactions);
      } finally {
        setLoadingCount((prev) => prev - 1);
      }
    })();
  };

  const fetchEpochAdjustment = async (
    netRepo: NetworkRepository
  ): Promise<number> => {
    let epochAdjustment = 0;

    await netRepo.getNetworkProperties().forEach((config) => {
      if (!config.network.epochAdjustment) {
        throw new Error("failed to get epochAdjustment");
      }

      epochAdjustment = Number(config.network.epochAdjustment.slice(0, -1));
    });

    return epochAdjustment;
  };

  const fetchTransactions = async (
    txRepo: TransactionRepository,
    epochAdjustment: number
  ) => {
    await txRepo
      .search({
        group: TransactionGroup.Confirmed,
        address: Address.createFromRawAddress(
          "NDHD4RURCULDJ6EXEJ675MS3QHCMTTFTWFG5IDQ"
        ),
        transferMosaicId: new MosaicId("606F8854012B0C0F"),
        pageSize: 100,
        order: Order.Desc,
      })
      .forEach((page) => {
        page.data.map((data) => processRawTransaction(data, epochAdjustment));
      });
  };

  const processRawTransaction = (data: SymbolTransaction, epochAdjustment: number) => {
    if (!(data instanceof TransferTransaction) || !validateData(data)) {
      return;
    }

    if (!data.transactionInfo || !data.transactionInfo.hash || !data.transactionInfo.timestamp) {
      return;
    }

    transactions.push({
      hash: data.transactionInfo.hash,
      timestamp: dayjs(
        epochAdjustment * 1000 + data.transactionInfo.timestamp.compact()
      ),
    });
  }

  const validateData = (data: TransferTransaction): boolean => {
    if (!data.transactionInfo) {
      throw new Error("failed to get transactionInfo");
    }

    if (!data.transactionInfo.hash) {
      throw new Error("failed to get hash");
    }

    if (!data.transactionInfo.timestamp) {
      throw new Error("failed to get timestamp");
    }

    if (data.message.payload !== "cigarette:smoked") {
      return false;
    }

    return true;
  };

  const processTransactions = (transactions: Transaction[]) => {
    const todayDate = dayjs().format("YYYY-MM-DD");
    let currentDate = "0000-00-00";
    setTodayCount(0);
    setCategories([]);
    setData([]);
    setCountPerHour([...Array(24)].map(() => 0));
    setHeatmapSeries(
      [...Array(24)]
        .map((_, idx): Series => {
          return {
            name: (idx + 1).toString(),
            data: (() =>
              [...Array(7)].map((_, idx) => {
                return { x: days[idx], y: 0 };
              }))(),
          };
        })
        .reverse()
    );

    [...transactions].reverse().map((tx) => {
      currentDate = processTransaction(tx, todayDate, currentDate);
    });
  };

  const processTransaction = (
    tx: Transaction,
    todayDate: string,
    currentDate: string
  ): string => {
    const yyyymmdd = tx.timestamp.format("YYYY-MM-DD");

    if (yyyymmdd === todayDate) {
      setTodayCount((prev) => prev + 1);
      setCountPerHour((prev) => {
        prev[tx.timestamp.hour()]++;
        return prev;
      });
    }

    if (yyyymmdd !== currentDate) {
      currentDate = yyyymmdd;
      setCategories((prev) => prev.concat(yyyymmdd));
      setData((prev) => prev.concat(0));
    }

    setData((prev) => {
      prev[prev.length - 1]++;
      return prev;
    });

    setHeatmapSeries((prev) => {
      prev[23 - tx.timestamp.hour()].data[tx.timestamp.day()].y++;
      return prev;
    });

    return currentDate;
  };

  useEffect(loadTransactions, []);

  /**
   * average - 日次平均の取得
   */
  const average = () => {
    if (data.length === 0) return 0;
    return data.reduce((acc, cur) => acc + cur) / data.length;
  };

  /**
   * isLoading - ロード中かどうか
   */
  const isLoading = (): boolean => {
    return loadingCount > 0;
  };

  /**
   * transactionsComponent - Transactions コンポーネント
   */
  const transactionsComponent = () => {
    return (
      <div className="overflow-x-auto">
        <table className="table table-compact w-full">
          <thead>
            <tr>
              <th>Timestamp</th>
            </tr>
          </thead>

          <tbody>
            {transactions.map((tx) => {
              const timestamp = tx.timestamp.format("YYYY-MM-DD HH:mm");
              return (
                <tr key={tx.hash}>
                  <th>{timestamp}</th>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <Link href="/">
            <a className="btn btn-ghost normal-case text-xl">cigalette</a>
          </Link>
        </div>
        <div className="flex-none">
          {(() => {
            if (isLoading()) {
              return (
                <button className="btn btn-outline btn-square mx-2">
                  <Icon
                    className="animate-spin"
                    path={mdiLoading}
                    size={1}
                  ></Icon>
                </button>
              );
            }
            return (
              <button
                className="btn btn-outline btn-square mx-2"
                onClick={() => loadTransactions()}
              >
                <Icon path={mdiReload} size={1}></Icon>
              </button>
            );
          })()}
          <Link href="https://github.com/mopeneko/cigarette-front">
            <button className="btn btn-outline btn-square">
              <Icon path={mdiGithub} size={1}></Icon>
            </button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto lg:px-64 mt-4">
        <div className="card bg-base-300">
          <div className="card-body">
            <h2 className="card-title">Overview</h2>
            <div className="divider"></div>
            <p>今日の本数: {todayCount} 本</p>
            <p>1日あたりの平均本数: {average()} 本</p>
          </div>
        </div>

        <div className="card bg-base-300 mt-4">
          <div className="card-body">
            <h2 className="card-title">Graphs</h2>
            <div className="divider"></div>
            <div className="grid xl:grid-cols-2 xl:gap-2">
              <Chart
                type="bar"
                options={dailyOptions}
                series={dailySeries}
              ></Chart>
              <Chart
                type="bar"
                options={perHourOptions}
                series={perHourSeries}
              ></Chart>
              <Chart
                type="heatmap"
                options={heatmapOptions}
                series={heatmapSeries}
              />
            </div>
          </div>
        </div>

        <div className="card bg-base-300 mt-4">
          <div className="card-body">
            <h2 className="card-title">Transactions</h2>
            <div className="divider"></div>
            {transactionsComponent()}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
