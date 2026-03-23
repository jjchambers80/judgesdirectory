import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/constants";

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  segments: BreadcrumbSegment[];
  currentPage: string;
}

export default function Breadcrumbs({
  segments,
  currentPage,
}: BreadcrumbsProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...segments.map((seg, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: seg.label,
        item: `${SITE_URL}${seg.href}`,
      })),
      {
        "@type": "ListItem",
        position: segments.length + 1,
        name: currentPage,
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          {segments.map((seg) => (
            <Fragment key={seg.href}>
              <BreadcrumbItem>
                <BreadcrumbLink href={seg.href}>{seg.label}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </Fragment>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPage}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
