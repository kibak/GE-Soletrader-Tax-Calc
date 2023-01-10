import { useState } from "react";
import Papa from "papaparse";
import moment from "moment";
import axios from "axios";

function App() {
  // State to store parsed data
  const [parsedData, setParsedData] = useState([]);
  const [tableRows, setTableRows] = useState([]);
  const [values, setValues] = useState([]);
  const [taxData, setTaxData] = useState([]);
  const [log, setLog] = useState("");

  const sleep = async (ms = 100) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    })
  }
  const patchValues = async (arr) => {
    let rate, date;
    for (let row of arr) {
      date = moment(row.Date,"DD-MM-YYYY");
      row.date = date.format('YYYY-MM-DD');
      row.month = date.format('YYYY-MM');
      row.year = date.format('YYYY');
      setLog("Get rate " + row.date + "...")
      rate = await axios.get("https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=EUR&date=" + row.date);
      if (Array.isArray(rate.data) && rate.data.length && rate.data[0].currencies[0]) {
        row.rate = rate.data[0].currencies[0].rateFormated;
        row.rateDate = rate.data[0].currencies[0].validFromDate;
      }
      await sleep(140);
    }
  }
  const changeHandler = (event) => {
    // Passing file data (event.target.files[0]) to parse using Papa.parse
    Papa.parse(event.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const rowsArray = [];
        const valuesArray = [];
        const monthIncome = {};

        const filteredData = results.data.filter(d => {
          return Number(d.Amount) > 0 && d["Payer Name"];
        });

        patchValues(filteredData).then(() => {
          filteredData.sort((a,b) => {
            return a.date < b.date ? -1 : 1;
          }).map((d) => {
            const amountGel = (Number(d.Amount) * Number(d.rate)).toFixed(2);
            if (! monthIncome[d.month]) monthIncome[d.month] = 0;
            monthIncome[d.month] = (Number(monthIncome[d.month]) + Number(amountGel)).toFixed(2);
            
            return {
              "Date": d.date,
              "Amount, EUR": d.Amount,
              "Rate EUR/GEL": d.rate,
              "Rate Valid date": d.rateDate,
              "Amount, GEL": amountGel,
              "Payer Name": d["Payer Name"],
              "Payment Reference": d["Payment Reference"]
            };
          }).map((d) => {
            rowsArray.push(Object.keys(d));
            valuesArray.push(Object.values(d));
          });

          setParsedData(results.data);
          setTableRows(rowsArray[0]);
          setValues(valuesArray);

          let turnover, turnoverYear, tax;
          setTaxData(Object.entries(monthIncome).sort((a,b) => {
            return a[0] < b[0] ? -1 : 1;
          }).map(([month, amount]) => {
            const currentYear = month.slice(0,4);
            if (currentYear !== turnoverYear) {
              turnover = 0;
              turnoverYear = currentYear;
            }
            turnover = (Number(turnover) + Number(amount)).toFixed(2);
            tax = (Number(amount) * 0.01).toFixed(2);
            return [month, turnover, amount, tax];
          }));
        });
      },
    });
  };

  return (
    <div>
      {values.length === 0 ? <div>
        <input
            type="file"
            name="file"
            onChange={changeHandler}
            accept=".csv"
        />
        <p><b>{log || "No data"}</b></p>
        <p>
          Calculates the annual tax base and monthly income<br/>
          at the exchange rate of the National Bank of Georgia<br/>
          based on the annual EUR wallet statement from WISE
        </p>
      </div> : <div>
        <h2>Monthly income in GEL</h2>
        <table>
          <thead>
          <tr>
            <th>Month</th>
            <th>Year turnover (field 15)</th>
            <th>Month turnover (field 17)</th>
            <th>Tax to pay (field 19)</th>
          </tr>
          </thead>
          <tbody>
          {taxData.map((arr, i) => {
            return <tr key={i}>
              {arr.map((v, j) => {
                return <td key={j}>{v}</td>;
              })}
            </tr>;
          })}
          </tbody>
        </table>
        <h2>Income payments</h2>
        <table>
          <thead>
          <tr>
            {tableRows.map((rows, index) => {
              return <th key={index}>{rows}</th>;
            })}
          </tr>
          </thead>
          <tbody>
          {values.map((value, index) => {
            return (
                <tr key={index}>
                  {value.map((val, i) => {
                    return <td key={i}>{val}</td>;
                  })}
                </tr>
            );
          })}
          </tbody>
        </table>
      </div>}
      <br />
    </div>
  );
}

export default App;
