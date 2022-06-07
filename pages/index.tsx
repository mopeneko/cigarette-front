import dayjs from 'dayjs';
import type { NextPage } from 'next'
import dynamic from 'next/dynamic';
import Link from 'next/link'
import { useEffect, useState } from 'react';
import { Address, MosaicId, Order, RepositoryFactoryHttp, TransactionGroup, TransferTransaction } from 'symbol-sdk';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Transaction {
  timestamp: dayjs.Dayjs;
}

interface Options {
  chart: Object;
  xaxis: {
    title: Object;
    categories: any[];
  };
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

  const dailyOptions: Options = {
    chart: {
      id: "basic-bar",
    },
    xaxis: {
      title: {
        text: "Counts"
      },
      categories: categories
    }
  };
  
  const dailySeries: Series[] = [
    {
      name: "Count",
      data: data
    }
  ];

  const perHourOptions: Options = {
    chart: {
      id: "basic-bar",
    },
    xaxis: {
      title: {
        text: "Counts per hour"
      },
      categories: [...Array(24)].map((_, i) => i)
    }
  };
  
  const perHourSeries: Series[] = [
    {
      name: "Count",
      data: countPerHour
    }
  ];

  useEffect(() => {
    const transactions: Transaction[] = [];

    (async () => {
      const repositoryFactory = new RepositoryFactoryHttp('http://01.symbol-blockchain.com:3000');
      const netRepo = repositoryFactory.createNetworkRepository();
      const txRepo = repositoryFactory.createTransactionRepository();

      let epockAdjustment = 0;

      await netRepo.
      getNetworkProperties().
      forEach((config) => {
        if (!config.network.epochAdjustment) {
          throw new Error('failed to get epockAdjustment');
        }
        epockAdjustment = Number(config.network.epochAdjustment.slice(0, -1));
      });

      await txRepo.search({
        group: TransactionGroup.Confirmed,
        address: Address.createFromRawAddress('NCV7OZVOETWMRX2JTJVEHD5K5SGSJ7FTSPI4UXI'),
        transferMosaicId: new MosaicId('606F8854012B0C0F'),
        pageSize: 100,
        order: Order.Desc,
      }).forEach((page) => {
        page.data.map((data) => {
          if (!data.transactionInfo?.timestamp) {
            throw new Error('failed to get transactionInfo');
          }

          if (!(data instanceof TransferTransaction)) {
            return;
          }

          if (data.message.payload !== 'cigarette:smoked') {
            return;
          }

          transactions.push({
            timestamp: dayjs(
              epockAdjustment * 1000 + data.transactionInfo.timestamp.compact()
            )
          });
        });
      });

      const todayDate = dayjs().format('YYYY-MM-DD');
      let currentDate = '0000-00-00';
      setTodayCount(0);
      setCategories([]);
      setData([]);
      setCountPerHour([...Array(24)].map(() => 0));

      transactions.reverse().map((tx) => {
        const yyyymmdd = tx.timestamp.format('YYYY-MM-DD');

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
          prev[prev.length-1]++;
          return prev;
        });
      })
    })();
  }, []);

  const average = () => {
    if (data.length === 0) return 0;
    return data.reduce(
      (acc, cur) => acc + cur
    ) / data.length;
  }

  return (
    <>
      <div className="navbar bg-base-100">
        <Link href="/">
          <a className="btn btn-ghost normal-case text-xl">cigalette</a>
        </Link>
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
              <Chart type="bar" options={dailyOptions} series={dailySeries}></Chart>
              <Chart type="bar" options={perHourOptions} series={perHourSeries}></Chart>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Home
