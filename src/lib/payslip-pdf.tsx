import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1c1917",
  },
  header: {
    marginBottom: 24,
    borderBottom: "1 solid #e7e5e4",
    paddingBottom: 16,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    color: "#78716c",
    marginTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#78716c",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: "0.5 solid #f5f5f4",
  },
  label: { color: "#57534e" },
  value: { fontFamily: "Helvetica-Bold" },
  netPay: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fafaf9",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  netPayLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  netPayValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#a8a29e",
    textAlign: "center",
  },
});

function formatKobo(kobo: string | bigint): string {
  const n = Number(kobo) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(n);
}

export interface PayslipPdfProps {
  companyName: string;
  companyAddress?: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  periodLabel: string;
  bankName?: string;
  bankAccount?: string;
  earnings: {
    basic: string;
    housing: string;
    transport: string;
    other: string;
    bonus: string;
    gross: string;
  };
  deductions: {
    paye: string;
    pension: string;
    nhf: string;
    other: string;
    total: string;
  };
  netPay: string;
  ytd: { gross: string; paye: string; net: string };
}

export function PayslipDocument(props: PayslipPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{props.companyName}</Text>
          {props.companyAddress && (
            <Text style={{ color: "#78716c" }}>{props.companyAddress}</Text>
          )}
          <Text style={styles.title}>Payslip — {props.periodLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{props.employeeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>{props.employeeCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.value}>{props.department}</Text>
          </View>
          {props.bankName && (
            <View style={styles.row}>
              <Text style={styles.label}>Bank Account</Text>
              <Text style={styles.value}>
                {props.bankName} — {props.bankAccount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          {[
            ["Basic Salary", props.earnings.basic],
            ["Housing Allowance", props.earnings.housing],
            ["Transport Allowance", props.earnings.transport],
            ["Other Allowances", props.earnings.other],
            ["Bonuses", props.earnings.bonus],
          ].map(([label, val]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text>{formatKobo(val)}</Text>
            </View>
          ))}
          <View style={[styles.row, { borderBottom: "none", marginTop: 4 }]}>
            <Text style={styles.value}>Gross Pay</Text>
            <Text style={styles.value}>{formatKobo(props.earnings.gross)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          {[
            ["PAYE Tax", props.deductions.paye],
            ["Pension (Employee)", props.deductions.pension],
            ["NHF", props.deductions.nhf],
            ["Other Deductions", props.deductions.other],
          ].map(([label, val]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text>{formatKobo(val)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.netPay}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={styles.netPayValue}>{formatKobo(props.netPay)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Year to Date</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Gross</Text>
            <Text>{formatKobo(props.ytd.gross)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>PAYE</Text>
            <Text>{formatKobo(props.ytd.paye)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Net</Text>
            <Text>{formatKobo(props.ytd.net)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a computer-generated payslip. For queries, contact HR.
        </Text>
      </Page>
    </Document>
  );
}
