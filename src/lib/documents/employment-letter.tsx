import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatDate } from "@/lib/utils";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1c1917",
  },
  letterhead: {
    marginBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#d6d3d1",
    paddingBottom: 12,
  },
  company: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#78716c", marginTop: 4 },
  date: { marginBottom: 20 },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 16,
    textAlign: "center",
  },
  body: { lineHeight: 1.5, marginBottom: 10 },
  footer: { marginTop: 36, fontSize: 10 },
});

export function EmploymentVerificationLetter(props: {
  companyName: string;
  companyAddress?: string | null;
  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  department: string;
  startDate: Date;
  employmentType: string;
  status: string;
  issuedAt?: Date;
}) {
  const issued = props.issuedAt ?? new Date();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <Text style={styles.company}>{props.companyName}</Text>
          {props.companyAddress ? (
            <Text style={styles.meta}>{props.companyAddress}</Text>
          ) : null}
        </View>
        <Text style={styles.date}>{formatDate(issued)}</Text>
        <Text style={styles.title}>EMPLOYMENT VERIFICATION LETTER</Text>
        <Text style={styles.body}>To Whom It May Concern,</Text>
        <Text style={styles.body}>
          This is to confirm that {props.employeeName} (Employee ID:{" "}
          {props.employeeCode}) is employed by {props.companyName} as{" "}
          {props.jobTitle} in the {props.department} department.
        </Text>
        <Text style={styles.body}>
          Employment commenced on {formatDate(props.startDate)}. Current
          employment type: {props.employmentType.replace(/_/g, " ")}. Status:{" "}
          {props.status.replace(/_/g, " ")}.
        </Text>
        <Text style={styles.body}>
          This letter is issued upon request for official verification purposes
          only.
        </Text>
        <View style={styles.footer}>
          <Text>Yours faithfully,</Text>
          <Text style={{ marginTop: 28 }}>________________________</Text>
          <Text>Human Resources</Text>
          <Text>{props.companyName}</Text>
        </View>
      </Page>
    </Document>
  );
}
