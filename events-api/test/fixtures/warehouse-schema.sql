--
-- PostgreSQL database dump
--

\restrict KrbdkfilgGvSzq4jgXETJyoo8XOJn1UFkgLY9cpqKxD84I5hzb6LGY6k0QlPAhQ

-- Dumped from database version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.24 (Ubuntu 14.24-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ab_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ab_points (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    period text DEFAULT 'month'::text NOT NULL,
    label text,
    note text,
    source text DEFAULT 'system'::text NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ab_points_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ab_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ab_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ab_points_id_seq OWNED BY public.ab_points.id;


--
-- Name: absences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absences (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_id integer NOT NULL,
    type text DEFAULT 'vacation'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: absences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absences_id_seq OWNED BY public.absences.id;


--
-- Name: ai_chat_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_log (
    id integer NOT NULL,
    user_id integer,
    company_id integer,
    prompt_tokens integer,
    completion_tokens integer,
    model character varying(60),
    latency_ms integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ai_chat_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_chat_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_chat_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_chat_log_id_seq OWNED BY public.ai_chat_log.id;


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    module text NOT NULL,
    severity text NOT NULL,
    title text NOT NULL,
    description text,
    action text,
    source_table text,
    source_id text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_by integer,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone
);


--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: anomalies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anomalies (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer NOT NULL,
    date date NOT NULL,
    module character varying(20) DEFAULT 'sales'::character varying NOT NULL,
    metric character varying(50) NOT NULL,
    expected_value numeric(18,2) DEFAULT 0 NOT NULL,
    actual_value numeric(18,2) DEFAULT 0 NOT NULL,
    deviation_pct numeric(8,2) DEFAULT 0 NOT NULL,
    severity character varying(20) NOT NULL,
    possible_causes text[] DEFAULT '{}'::text[],
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    reviewed_by integer,
    review_note text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: anomalies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.anomalies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: anomalies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.anomalies_id_seq OWNED BY public.anomalies.id;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_id integer,
    work_date date NOT NULL,
    planned_start timestamp with time zone,
    planned_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    hours numeric(6,2),
    late_minutes integer DEFAULT 0,
    status text DEFAULT 'expected'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: audit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_items (
    id integer NOT NULL,
    audit_id integer NOT NULL,
    product_id integer NOT NULL,
    book_qty numeric DEFAULT 0 NOT NULL,
    actual_qty numeric,
    diff_sum numeric,
    status text
);


--
-- Name: audit_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_items_id_seq OWNED BY public.audit_items.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    user_id integer,
    username character varying(100),
    action character varying(60) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    old_value jsonb,
    new_value jsonb,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT now(),
    company_id integer,
    branch_id integer,
    user_role character varying(20),
    module character varying(30),
    description text,
    is_suspicious boolean DEFAULT false,
    suspicious_reason character varying(255)
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: balance_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balance_entries (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    period date,
    total_assets numeric(18,2) DEFAULT 0,
    equity numeric(18,2) DEFAULT 0,
    depreciation numeric(18,2) DEFAULT 0,
    interest_expense numeric(18,2) DEFAULT 0,
    taxes numeric(18,2) DEFAULT 0,
    manual_liabilities numeric DEFAULT 0,
    manual_interest_expense numeric DEFAULT 0,
    manual_equity numeric DEFAULT 0,
    manual_other_assets numeric DEFAULT 0,
    manual_fixed_assets numeric DEFAULT 0,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: balance_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.balance_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: balance_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.balance_entries_id_seq OWNED BY public.balance_entries.id;


--
-- Name: basket_pairs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.basket_pairs (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    product_a_id integer NOT NULL,
    product_b_id integer NOT NULL,
    together_count integer DEFAULT 0 NOT NULL,
    count_a integer DEFAULT 0 NOT NULL,
    count_b integer DEFAULT 0 NOT NULL,
    baskets_total integer DEFAULT 0 NOT NULL,
    support_pct numeric(6,3) DEFAULT 0 NOT NULL,
    confidence_a_b numeric(6,2) DEFAULT 0 NOT NULL,
    confidence_b_a numeric(6,2) DEFAULT 0 NOT NULL,
    lift numeric(8,3) DEFAULT 0 NOT NULL,
    avg_basket_uzs numeric(18,2) DEFAULT 0 NOT NULL,
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: basket_pairs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.basket_pairs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: basket_pairs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.basket_pairs_id_seq OWNED BY public.basket_pairs.id;


--
-- Name: bhi_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bhi_daily (
    company_id integer NOT NULL,
    date date NOT NULL,
    days_active integer DEFAULT 0 NOT NULL,
    bhi numeric(6,2) DEFAULT 0 NOT NULL,
    revenue_weight numeric(5,2) DEFAULT 0 NOT NULL,
    blocks_active integer DEFAULT 0 NOT NULL,
    fin_health numeric(6,2),
    ops_health numeric(6,2),
    people_health numeric(6,2),
    market_health numeric(6,2),
    blocks jsonb DEFAULT '{}'::jsonb NOT NULL,
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: bonus_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bonus_transactions (
    id integer NOT NULL,
    company_id integer NOT NULL,
    customer_id integer NOT NULL,
    type character varying(16) NOT NULL,
    amount numeric(16,2) NOT NULL,
    source character varying(20),
    source_id integer,
    balance_after numeric(16,2),
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bonus_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bonus_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bonus_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bonus_transactions_id_seq OWNED BY public.bonus_transactions.id;


--
-- Name: branch_daily_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_daily_summary (
    branch_id integer NOT NULL,
    date date NOT NULL,
    income_uzs numeric(16,2) DEFAULT 0 NOT NULL,
    expense_uzs numeric(16,2) DEFAULT 0 NOT NULL,
    gross_profit numeric(16,2) DEFAULT 0 NOT NULL,
    stock_value numeric(16,2) DEFAULT 0 NOT NULL,
    margin_pct numeric(7,2) DEFAULT 0 NOT NULL,
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(200) NOT NULL,
    address text,
    phone character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    created_by integer,
    area_sqm numeric,
    rent_monthly_uzs numeric
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: bsc_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsc_departments (
    id integer NOT NULL,
    strategy_id integer NOT NULL,
    name text NOT NULL,
    weight_pct numeric(5,2) DEFAULT 0 NOT NULL,
    color character varying(7),
    display_order integer DEFAULT 0
);


--
-- Name: bsc_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsc_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsc_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsc_departments_id_seq OWNED BY public.bsc_departments.id;


--
-- Name: bsc_fact_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsc_fact_values (
    id integer NOT NULL,
    metric_id integer NOT NULL,
    fact_date date NOT NULL,
    fact_value numeric(15,2) DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bsc_fact_values_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsc_fact_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsc_fact_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsc_fact_values_id_seq OWNED BY public.bsc_fact_values.id;


--
-- Name: bsc_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsc_metrics (
    id integer NOT NULL,
    department_id integer NOT NULL,
    name text NOT NULL,
    unit text,
    source_type text DEFAULT 'manual'::text NOT NULL,
    plan_year_1 numeric(15,2) DEFAULT 0,
    plan_year_2 numeric(15,2) DEFAULT 0,
    plan_year_3 numeric(15,2) DEFAULT 0,
    display_order integer DEFAULT 0,
    weight_pct numeric(5,2) DEFAULT 0 NOT NULL
);


--
-- Name: bsc_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsc_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsc_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsc_metrics_id_seq OWNED BY public.bsc_metrics.id;


--
-- Name: bsc_period_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsc_period_plans (
    id integer NOT NULL,
    metric_id integer NOT NULL,
    period_type text NOT NULL,
    period_no integer NOT NULL,
    plan_value numeric(15,2) DEFAULT 0 NOT NULL
);


--
-- Name: bsc_period_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsc_period_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsc_period_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsc_period_plans_id_seq OWNED BY public.bsc_period_plans.id;


--
-- Name: bsc_strategies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bsc_strategies (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_score numeric(5,2),
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bsc_strategies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bsc_strategies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bsc_strategies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bsc_strategies_id_seq OWNED BY public.bsc_strategies.id;


--
-- Name: cash_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_categories (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    type character varying(10) NOT NULL,
    branch_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cash_categories_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


--
-- Name: cash_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_categories_id_seq OWNED BY public.cash_categories.id;


--
-- Name: cash_expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_expense (
    id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    currency character varying(10) DEFAULT 'UZS'::character varying,
    original_amount numeric(14,2),
    exchange_rate numeric(14,4) DEFAULT 1,
    category text
);


--
-- Name: cash_expense_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_expense_id_seq OWNED BY public.cash_expense.id;


--
-- Name: cash_income; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_income (
    id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    outcome_id integer,
    is_settled boolean DEFAULT true,
    settled_at timestamp without time zone,
    settled_by integer,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    currency character varying(10) DEFAULT 'UZS'::character varying,
    original_amount numeric(14,2),
    exchange_rate numeric(14,4) DEFAULT 1
);


--
-- Name: cash_income_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_income_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_income_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_income_id_seq OWNED BY public.cash_income.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name_ru character varying(100) NOT NULL,
    name_uz character varying(100) NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: channel_spend; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_spend (
    id integer NOT NULL,
    company_id integer NOT NULL,
    channel character varying(40) NOT NULL,
    month date NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: channel_spend_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channel_spend_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channel_spend_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channel_spend_id_seq OWNED BY public.channel_spend.id;


--
-- Name: checklist_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_completions (
    id integer NOT NULL,
    template_id integer NOT NULL,
    branch_id integer NOT NULL,
    completed_by integer,
    date date NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    items_total integer DEFAULT 0 NOT NULL,
    items_done integer DEFAULT 0 NOT NULL
);


--
-- Name: checklist_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_completions_id_seq OWNED BY public.checklist_completions.id;


--
-- Name: checklist_item_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_item_results (
    id integer NOT NULL,
    completion_id integer NOT NULL,
    template_item_id integer NOT NULL,
    is_done boolean DEFAULT false NOT NULL,
    done_at timestamp without time zone,
    note text
);


--
-- Name: checklist_item_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_item_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_item_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_item_results_id_seq OWNED BY public.checklist_item_results.id;


--
-- Name: checklist_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_template_items (
    id integer NOT NULL,
    template_id integer NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    is_required boolean DEFAULT true NOT NULL,
    requires_photo boolean DEFAULT false NOT NULL
);


--
-- Name: checklist_template_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_template_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_template_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_template_items_id_seq OWNED BY public.checklist_template_items.id;


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(20) DEFAULT 'custom'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: checklist_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: checklist_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_templates_id_seq OWNED BY public.checklist_templates.id;


--
-- Name: cohort_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cohort_cache (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    cohort_month date NOT NULL,
    cohort_size integer DEFAULT 0 NOT NULL,
    retention jsonb DEFAULT '{}'::jsonb NOT NULL,
    revenue jsonb DEFAULT '{}'::jsonb NOT NULL,
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: cohort_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cohort_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cohort_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cohort_cache_id_seq OWNED BY public.cohort_cache.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    address text,
    phone character varying(50),
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    biz_type character varying(20),
    started_at date,
    goal_bhi integer,
    disabled_tools text[] DEFAULT '{}'::text[],
    hr_criteria jsonb DEFAULT '{}'::jsonb,
    disabled_widgets text[] DEFAULT '{}'::text[],
    logo_url text,
    is_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: company_bhi_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_bhi_config (
    company_id integer NOT NULL,
    target_mode character varying(8) DEFAULT 'auto'::character varying NOT NULL,
    manual_target smallint,
    business_type character varying(40) DEFAULT 'retail'::character varying NOT NULL,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: company_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_features (
    company_id integer NOT NULL,
    feature_key character varying(60) NOT NULL,
    enabled boolean DEFAULT false,
    plan_tier character varying(30) DEFAULT 'basic'::character varying,
    enabled_at timestamp without time zone DEFAULT now(),
    enabled_by integer
);


--
-- Name: company_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_integrations (
    id integer NOT NULL,
    company_id integer NOT NULL,
    type character varying(40) NOT NULL,
    status character varying(20) DEFAULT 'connected'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_event text,
    last_event_at timestamp without time zone,
    connected_by integer,
    connected_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: company_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_integrations_id_seq OWNED BY public.company_integrations.id;


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name text NOT NULL,
    sku integer DEFAULT 0,
    avg_price numeric DEFAULT 0,
    rating numeric DEFAULT 0,
    service integer DEFAULT 0,
    locations integer DEFAULT 0,
    online integer DEFAULT 0,
    source text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: competitors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitors_id_seq OWNED BY public.competitors.id;


--
-- Name: complaint_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaint_history (
    id integer NOT NULL,
    complaint_id integer NOT NULL,
    event_type text NOT NULL,
    old_value text,
    new_value text,
    comment text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: complaint_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complaint_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complaint_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complaint_history_id_seq OWNED BY public.complaint_history.id;


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    customer_id integer,
    customer_name text,
    customer_phone text,
    category text DEFAULT 'other'::text NOT NULL,
    description text,
    channel text DEFAULT 'in_store'::text NOT NULL,
    related_employee_id integer,
    status text DEFAULT 'new'::text NOT NULL,
    urgency text DEFAULT 'normal'::text NOT NULL,
    assigned_to integer,
    resolution text,
    compensation_type text,
    compensation_amount numeric(16,2) DEFAULT 0 NOT NULL,
    customer_satisfaction smallint,
    resolved_at timestamp without time zone,
    resolved_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: complaints_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complaints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complaints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complaints_id_seq OWNED BY public.complaints.id;


--
-- Name: course_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_progress (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    lesson_id integer NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: course_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_progress_id_seq OWNED BY public.course_progress.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    company_id integer NOT NULL,
    "position" text NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: customer_bonuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_bonuses (
    customer_id integer NOT NULL,
    company_id integer NOT NULL,
    balance_uzs numeric(16,2) DEFAULT 0 NOT NULL,
    earned_total numeric(16,2) DEFAULT 0 NOT NULL,
    used_total numeric(16,2) DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_rfm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_rfm (
    customer_id integer NOT NULL,
    company_id integer NOT NULL,
    r_score smallint DEFAULT 1 NOT NULL,
    f_score smallint DEFAULT 1 NOT NULL,
    m_score smallint DEFAULT 1 NOT NULL,
    last_purchase_date date,
    days_since_last integer,
    total_orders integer DEFAULT 0 NOT NULL,
    total_spent_uzs numeric(16,2) DEFAULT 0 NOT NULL,
    segment character varying(30) NOT NULL,
    segment_label character varying(60),
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_rfm_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_rfm_history (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    company_id integer NOT NULL,
    period date NOT NULL,
    segment character varying(30) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_rfm_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_rfm_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_rfm_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_rfm_history_id_seq OWNED BY public.customer_rfm_history.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50),
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone,
    source character varying(40),
    birth_date date
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: debt_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.debt_payments (
    id integer NOT NULL,
    outcome_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    paid_at timestamp without time zone DEFAULT now(),
    received_by integer,
    note text,
    CONSTRAINT debt_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: debt_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.debt_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: debt_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.debt_payments_id_seq OWNED BY public.debt_payments.id;


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discounts (
    id integer NOT NULL,
    company_id integer,
    branch_id integer,
    name text NOT NULL,
    type text DEFAULT 'percent'::text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    min_qty integer,
    starts_at date,
    ends_at date,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discounts_id_seq OWNED BY public.discounts.id;


--
-- Name: employee_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_adjustments (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_id integer NOT NULL,
    type text NOT NULL,
    category text,
    amount bigint DEFAULT 0 NOT NULL,
    source text DEFAULT 'manual'::text,
    note text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_adjustments_id_seq OWNED BY public.employee_adjustments.id;


--
-- Name: event_greetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_greetings (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    company_id integer NOT NULL,
    event_type character varying(40) DEFAULT 'birthday'::character varying NOT NULL,
    event_year integer NOT NULL,
    channel character varying(20) DEFAULT 'sms'::character varying NOT NULL,
    promo_code character varying(40),
    discount_pct smallint DEFAULT 15 NOT NULL,
    used boolean DEFAULT false NOT NULL,
    sent_at timestamp without time zone DEFAULT now()
);


--
-- Name: event_greetings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_greetings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_greetings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_greetings_id_seq OWNED BY public.event_greetings.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id integer NOT NULL,
    currency text NOT NULL,
    rate numeric NOT NULL,
    date date NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    category character varying(20) DEFAULT 'equipment'::character varying NOT NULL,
    name character varying(160) NOT NULL,
    acquisition_cost numeric(16,2) DEFAULT 0 NOT NULL,
    acquired_at date,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: fixed_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fixed_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fixed_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fixed_assets_id_seq OWNED BY public.fixed_assets.id;


--
-- Name: funnel_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funnel_inputs (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    period date NOT NULL,
    ad_views integer DEFAULT 0 NOT NULL,
    visitors integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: funnel_inputs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.funnel_inputs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: funnel_inputs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.funnel_inputs_id_seq OWNED BY public.funnel_inputs.id;


--
-- Name: inventory_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audits (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    matched integer DEFAULT 0 NOT NULL,
    loss_sum numeric DEFAULT 0 NOT NULL,
    created_by integer
);


--
-- Name: inventory_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_audits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_audits_id_seq OWNED BY public.inventory_audits.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    name character varying(200),
    phone character varying(60),
    email character varying(200),
    source character varying(40) DEFAULT 'other'::character varying NOT NULL,
    interest text,
    status character varying(20) DEFAULT 'new'::character varying NOT NULL,
    est_value numeric(16,2) DEFAULT 0 NOT NULL,
    assigned_to integer,
    closed_at timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id integer NOT NULL,
    course_id integer NOT NULL,
    title text NOT NULL,
    video_url text,
    duration_min integer DEFAULT 0 NOT NULL,
    ord integer DEFAULT 0 NOT NULL
);


--
-- Name: lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lessons_id_seq OWNED BY public.lessons.id;


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    lender character varying(160),
    remaining_balance numeric(16,2) DEFAULT 0 NOT NULL,
    annual_rate numeric(7,3),
    monthly_payment numeric(16,2),
    closed_at date,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: loans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loans_id_seq OWNED BY public.loans.id;


--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_accounts (
    id integer NOT NULL,
    company_id integer NOT NULL,
    customer_id integer NOT NULL,
    tier text DEFAULT 'standard'::text NOT NULL,
    points_balance bigint DEFAULT 0 NOT NULL,
    total_spent bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loyalty_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loyalty_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loyalty_accounts_id_seq OWNED BY public.loyalty_accounts.id;


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id integer NOT NULL,
    account_id integer NOT NULL,
    type text DEFAULT 'earn'::text NOT NULL,
    points bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: loyalty_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loyalty_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loyalty_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loyalty_transactions_id_seq OWNED BY public.loyalty_transactions.id;


--
-- Name: marketing_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_content (
    id integer NOT NULL,
    company_id integer NOT NULL,
    title character varying(200) NOT NULL,
    platform character varying(40) DEFAULT 'instagram'::character varying NOT NULL,
    format character varying(40) DEFAULT 'post'::character varying NOT NULL,
    scheduled_for date,
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    persona_id integer,
    hook text,
    body text,
    cta text,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    funnel_stage character varying(8),
    reference_link text,
    plan_views integer,
    plan_likes integer,
    plan_comments integer,
    fact_views integer,
    fact_likes integer,
    fact_comments integer,
    analysis text
);


--
-- Name: marketing_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marketing_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketing_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marketing_content_id_seq OWNED BY public.marketing_content.id;


--
-- Name: marketing_personas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_personas (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(120) NOT NULL,
    age_range character varying(40),
    gender character varying(20),
    jtbd text,
    pains text,
    objections text,
    channels character varying(200),
    budget character varying(60),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: marketing_personas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marketing_personas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marketing_personas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marketing_personas_id_seq OWNED BY public.marketing_personas.id;


--
-- Name: notification_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_campaigns (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    segment text DEFAULT 'all'::text NOT NULL,
    message text NOT NULL,
    channel text DEFAULT 'telegram'::text NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    read_count integer DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_campaigns_id_seq OWNED BY public.notification_campaigns.id;


--
-- Name: payroll_liab; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_liab (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_name character varying(160),
    gross_accrued numeric(16,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(16,2) DEFAULT 0 NOT NULL,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: payroll_liab_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payroll_liab_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payroll_liab_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payroll_liab_id_seq OWNED BY public.payroll_liab.id;


--
-- Name: penalty_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.penalty_rules (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name text NOT NULL,
    amount bigint DEFAULT 0 NOT NULL
);


--
-- Name: penalty_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.penalty_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: penalty_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.penalty_rules_id_seq OWNED BY public.penalty_rules.id;


--
-- Name: police_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.police_alerts (
    id integer NOT NULL,
    company_id integer,
    branch_id integer,
    employee_id integer,
    severity character varying(16) DEFAULT 'low'::character varying,
    title character varying(255),
    description text,
    est_loss numeric DEFAULT 0,
    rule_code character varying(120),
    status character varying(16) DEFAULT 'new'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: police_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.police_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: police_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.police_alerts_id_seq OWNED BY public.police_alerts.id;


--
-- Name: police_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.police_rules (
    id integer NOT NULL,
    company_id integer,
    code character varying(64),
    title character varying(255),
    threshold numeric DEFAULT 0,
    severity character varying(16) DEFAULT 'low'::character varying,
    enabled boolean DEFAULT true
);


--
-- Name: police_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.police_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: police_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.police_rules_id_seq OWNED BY public.police_rules.id;


--
-- Name: product_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_stock (
    id integer NOT NULL,
    product_id integer,
    quantity numeric(12,3) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    CONSTRAINT product_stock_quantity_nonneg CHECK ((quantity >= (0)::numeric))
);


--
-- Name: product_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_stock_id_seq OWNED BY public.product_stock.id;


--
-- Name: product_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_types (
    id integer NOT NULL,
    name_ru character varying(100) NOT NULL,
    name_uz character varying(100) NOT NULL
);


--
-- Name: product_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_types_id_seq OWNED BY public.product_types.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name_ru character varying(200) NOT NULL,
    name_uz character varying(200),
    type_id integer,
    category_id integer,
    barcode character varying(50),
    photo_url character varying(500),
    unit character varying(32) DEFAULT 'шт'::character varying,
    price_buy numeric(12,2) DEFAULT 0,
    price_sell numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    color_size character varying(255),
    brand character varying(150),
    branch_id integer,
    company_id integer,
    deleted_at timestamp without time zone,
    lead_time_days integer DEFAULT 7,
    min_stock numeric DEFAULT 0,
    price_green numeric(12,2),
    price_yellow numeric(12,2),
    price_red numeric(12,2)
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    qty numeric DEFAULT 0 NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL
);


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_items_id_seq OWNED BY public.purchase_order_items.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    supplier_id integer,
    status text DEFAULT 'draft'::text NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    expected_at date,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: receiving_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receiving_items (
    id integer NOT NULL,
    receiving_id integer NOT NULL,
    product_id integer,
    ordered_qty numeric(14,2) DEFAULT 0,
    received_qty numeric(14,2) DEFAULT 0,
    diff numeric(14,2) DEFAULT 0,
    note text
);


--
-- Name: receiving_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receiving_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receiving_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receiving_items_id_seq OWNED BY public.receiving_items.id;


--
-- Name: receivings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivings (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    supplier_id integer,
    order_id integer,
    invoice_no character varying(60),
    total_amount numeric(16,2) DEFAULT 0,
    status character varying(20) DEFAULT 'full'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: receivings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receivings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receivings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receivings_id_seq OWNED BY public.receivings.id;


--
-- Name: referral_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_codes (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    company_id integer NOT NULL,
    code character varying(40) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: referral_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referral_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referral_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referral_codes_id_seq OWNED BY public.referral_codes.id;


--
-- Name: referral_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_settings (
    company_id integer NOT NULL,
    min_purchase_uzs numeric(16,2) DEFAULT 50000 NOT NULL,
    bonus_to_referrer numeric(16,2) DEFAULT 20000 NOT NULL,
    discount_pct numeric(6,2) DEFAULT 15 NOT NULL,
    validity_days integer DEFAULT 90 NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    company_id integer NOT NULL,
    referrer_id integer NOT NULL,
    referred_id integer NOT NULL,
    promo_code character varying(40),
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    first_purchase_id integer,
    first_purchase_amount numeric(16,2),
    bonus_amount numeric(16,2),
    discount_pct numeric(6,2),
    activated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    customer_id integer,
    is_anonymous boolean DEFAULT false NOT NULL,
    score integer NOT NULL,
    comment text,
    type text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: role_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_change_log (
    id integer NOT NULL,
    user_id integer,
    username character varying(50),
    old_role character varying(20),
    new_role character varying(20),
    changed_by integer,
    changed_by_username character varying(50),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: role_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_change_log_id_seq OWNED BY public.role_change_log.id;


--
-- Name: salaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salaries (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_id integer NOT NULL,
    period text NOT NULL,
    base numeric DEFAULT 0 NOT NULL,
    commission numeric DEFAULT 0 NOT NULL,
    bonus numeric DEFAULT 0 NOT NULL,
    penalty numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: salaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salaries_id_seq OWNED BY public.salaries.id;


--
-- Name: sale_edit_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_edit_requests (
    id integer NOT NULL,
    outcome_id integer NOT NULL,
    requested_by integer NOT NULL,
    old_quantity numeric(12,3),
    old_price numeric(12,2),
    old_note text,
    new_quantity numeric(12,3),
    new_price numeric(12,2),
    new_note text,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    review_note text,
    CONSTRAINT sale_edit_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: sale_edit_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sale_edit_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_edit_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sale_edit_requests_id_seq OWNED BY public.sale_edit_requests.id;


--
-- Name: sales_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_scripts (
    id integer NOT NULL,
    company_id integer,
    title text NOT NULL,
    situation text,
    steps text,
    active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_scripts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_scripts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_scripts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_scripts_id_seq OWNED BY public.sales_scripts.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    employee_id integer NOT NULL,
    work_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    hours numeric(5,2),
    status text DEFAULT 'planned'::text NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: script_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.script_usage (
    id integer NOT NULL,
    script_id integer,
    employee_id integer,
    result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: script_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.script_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: script_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.script_usage_id_seq OWNED BY public.script_usage.id;


--
-- Name: shift_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_templates (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_min integer DEFAULT 0 NOT NULL
);


--
-- Name: shift_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shift_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shift_templates_id_seq OWNED BY public.shift_templates.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    opened_by integer NOT NULL,
    opened_at timestamp without time zone DEFAULT now(),
    opening_cash numeric(14,2) DEFAULT 0,
    closed_by integer,
    closed_at timestamp without time zone,
    expected_cash numeric(14,2),
    actual_cash numeric(14,2),
    discrepancy numeric(14,2),
    status character varying(20) DEFAULT 'open'::character varying,
    note text,
    CONSTRAINT shifts_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: stock_income; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_income (
    id integer NOT NULL,
    product_id integer,
    quantity numeric(12,3) NOT NULL,
    price numeric(12,2),
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    supplier character varying(200),
    exchange_rate numeric(10,2) DEFAULT 0,
    branch_id integer,
    supplier_id integer,
    currency character varying(10) DEFAULT 'UZS'::character varying,
    payment_status character varying(20) DEFAULT 'paid'::character varying,
    paid_amount numeric(14,2) DEFAULT 0,
    due_date date,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    CONSTRAINT stock_income_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['paid'::character varying, 'debt'::character varying, 'partial'::character varying])::text[]))),
    CONSTRAINT stock_income_qty_positive CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_income_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_income_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_income_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_income_id_seq OWNED BY public.stock_income.id;


--
-- Name: stock_outcome; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_outcome (
    id integer NOT NULL,
    product_id integer,
    quantity numeric(12,3) NOT NULL,
    price numeric(12,2),
    note text,
    created_by integer,
    approved_by integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    branch_id integer,
    customer_id integer,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    payment_status character varying(20) DEFAULT 'paid'::character varying,
    paid_amount numeric(12,2) DEFAULT 0,
    due_date date,
    outcome_type character varying(30) DEFAULT 'sale'::character varying,
    supplier_id integer,
    writeoff_reason text,
    original_outcome_id integer,
    currency character varying(8) DEFAULT 'UZS'::character varying,
    original_price numeric(14,4),
    exchange_rate numeric(14,4) DEFAULT 1,
    CONSTRAINT stock_outcome_outcome_type_check CHECK (((outcome_type)::text = ANY ((ARRAY['sale'::character varying, 'return_to_supplier'::character varying, 'writeoff'::character varying, 'customer_return'::character varying])::text[]))),
    CONSTRAINT stock_outcome_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['paid'::character varying, 'debt'::character varying, 'partial'::character varying])::text[]))),
    CONSTRAINT stock_outcome_qty_nonneg CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT stock_outcome_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: stock_outcome_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_outcome_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_outcome_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_outcome_id_seq OWNED BY public.stock_outcome.id;


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id integer NOT NULL,
    company_id integer NOT NULL,
    product_id integer NOT NULL,
    from_branch integer NOT NULL,
    to_branch integer NOT NULL,
    qty numeric NOT NULL,
    status text DEFAULT 'in_transit'::text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    received_at timestamp with time zone,
    created_by integer
);


--
-- Name: stock_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_transfers_id_seq OWNED BY public.stock_transfers.id;


--
-- Name: supplier_debt_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_debt_payments (
    id integer NOT NULL,
    income_id integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_method character varying(20) DEFAULT 'cash'::character varying,
    currency character varying(10) DEFAULT 'UZS'::character varying,
    original_amount numeric(14,2),
    exchange_rate numeric(14,4) DEFAULT 1,
    paid_at timestamp without time zone DEFAULT now(),
    paid_by integer,
    note text,
    CONSTRAINT supplier_debt_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: supplier_debt_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_debt_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_debt_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_debt_payments_id_seq OWNED BY public.supplier_debt_payments.id;


--
-- Name: supplier_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_returns (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    supplier_id integer,
    product_id integer NOT NULL,
    qty numeric(16,2) DEFAULT 0 NOT NULL,
    amount numeric(16,2) DEFAULT 0 NOT NULL,
    reason text,
    status text DEFAULT 'open'::text NOT NULL,
    compensation_type text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_returns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_returns_id_seq OWNED BY public.supplier_returns.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    company_id integer NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50),
    email character varying(200),
    contact_person character varying(200),
    address text,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    author_id integer,
    text text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: task_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_comments_id_seq OWNED BY public.task_comments.id;


--
-- Name: task_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_events (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    task_id integer NOT NULL,
    actor_id integer,
    recipient_id integer,
    kind character varying(20) NOT NULL,
    from_status character varying(20),
    to_status character varying(20),
    payload jsonb,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: task_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_events_id_seq OWNED BY public.task_events.id;


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_templates (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    title text NOT NULL,
    description text,
    assignee_type character varying(20) DEFAULT 'manager'::character varying NOT NULL,
    assignee_id integer,
    assignee_role character varying(20),
    recurrence character varying(30) NOT NULL,
    recurrence_time time without time zone,
    priority character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: task_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_templates_id_seq OWNED BY public.task_templates.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    title text NOT NULL,
    description text,
    assignee_id integer,
    created_by integer,
    priority text DEFAULT 'medium'::text,
    due_date date,
    due_time time without time zone,
    status text DEFAULT 'todo'::text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    source text DEFAULT 'manual'::text,
    source_alert_id integer,
    source_template_id integer,
    tags text[],
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: tax_obligations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_obligations (
    id integer NOT NULL,
    company_id integer NOT NULL,
    branch_id integer,
    kind character varying(60),
    amount_accrued numeric(16,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(16,2) DEFAULT 0 NOT NULL,
    due_date date,
    note text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tax_obligations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tax_obligations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_obligations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tax_obligations_id_seq OWNED BY public.tax_obligations.id;


--
-- Name: tax_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_payments (
    id integer NOT NULL,
    company_id integer NOT NULL,
    period text NOT NULL,
    base_amount numeric(18,2) DEFAULT 0 NOT NULL,
    rate_pct numeric(6,2) DEFAULT 4 NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date date,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tax_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tax_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tax_payments_id_seq OWNED BY public.tax_payments.id;


--
-- Name: tax_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_settings (
    company_id integer NOT NULL,
    regime text DEFAULT 'simplified'::text NOT NULL,
    rate_pct numeric(6,2) DEFAULT 4 NOT NULL,
    period_type text DEFAULT 'quarter'::text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_id integer,
    branch_id integer,
    is_blocked boolean DEFAULT false,
    first_name character varying(100),
    last_name character varying(100),
    created_by integer,
    last_login_at timestamp without time zone,
    blocked_tools text[] DEFAULT '{}'::text[],
    ai_enabled boolean DEFAULT true,
    photo text,
    birth_date date,
    education text,
    experience text,
    prev_jobs text,
    phone character varying(40),
    "position" character varying(120),
    hired_at date,
    profile_notes text,
    session_id text,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'director'::character varying, 'founder'::character varying, 'manager'::character varying, 'cashier'::character varying, 'warehouse'::character varying, 'seller'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wow_bep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wow_bep (
    id integer DEFAULT 1 NOT NULL,
    sub_price numeric DEFAULT 0 NOT NULL,
    fixed_costs numeric DEFAULT 0 NOT NULL,
    var_cost numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'сум'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invest numeric,
    fixed_monthly numeric DEFAULT 0 NOT NULL,
    var_per_client numeric DEFAULT 0 NOT NULL,
    fixed_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    var_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    manual_revenue numeric,
    manual_clients numeric,
    plan_check numeric,
    plan_clients numeric,
    plan_profit numeric,
    manual_months jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT wow_bep_singleton CHECK ((id = 1))
);


--
-- Name: ab_points id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_points ALTER COLUMN id SET DEFAULT nextval('public.ab_points_id_seq'::regclass);


--
-- Name: absences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences ALTER COLUMN id SET DEFAULT nextval('public.absences_id_seq'::regclass);


--
-- Name: ai_chat_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log ALTER COLUMN id SET DEFAULT nextval('public.ai_chat_log_id_seq'::regclass);


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: anomalies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomalies ALTER COLUMN id SET DEFAULT nextval('public.anomalies_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: audit_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items ALTER COLUMN id SET DEFAULT nextval('public.audit_items_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: balance_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_entries ALTER COLUMN id SET DEFAULT nextval('public.balance_entries_id_seq'::regclass);


--
-- Name: basket_pairs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.basket_pairs ALTER COLUMN id SET DEFAULT nextval('public.basket_pairs_id_seq'::regclass);


--
-- Name: bonus_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus_transactions ALTER COLUMN id SET DEFAULT nextval('public.bonus_transactions_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: bsc_departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_departments ALTER COLUMN id SET DEFAULT nextval('public.bsc_departments_id_seq'::regclass);


--
-- Name: bsc_fact_values id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_fact_values ALTER COLUMN id SET DEFAULT nextval('public.bsc_fact_values_id_seq'::regclass);


--
-- Name: bsc_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_metrics ALTER COLUMN id SET DEFAULT nextval('public.bsc_metrics_id_seq'::regclass);


--
-- Name: bsc_period_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_period_plans ALTER COLUMN id SET DEFAULT nextval('public.bsc_period_plans_id_seq'::regclass);


--
-- Name: bsc_strategies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_strategies ALTER COLUMN id SET DEFAULT nextval('public.bsc_strategies_id_seq'::regclass);


--
-- Name: cash_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_categories ALTER COLUMN id SET DEFAULT nextval('public.cash_categories_id_seq'::regclass);


--
-- Name: cash_expense id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_expense ALTER COLUMN id SET DEFAULT nextval('public.cash_expense_id_seq'::regclass);


--
-- Name: cash_income id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income ALTER COLUMN id SET DEFAULT nextval('public.cash_income_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: channel_spend id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_spend ALTER COLUMN id SET DEFAULT nextval('public.channel_spend_id_seq'::regclass);


--
-- Name: checklist_completions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_completions ALTER COLUMN id SET DEFAULT nextval('public.checklist_completions_id_seq'::regclass);


--
-- Name: checklist_item_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_item_results ALTER COLUMN id SET DEFAULT nextval('public.checklist_item_results_id_seq'::regclass);


--
-- Name: checklist_template_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_template_items_id_seq'::regclass);


--
-- Name: checklist_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates ALTER COLUMN id SET DEFAULT nextval('public.checklist_templates_id_seq'::regclass);


--
-- Name: cohort_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_cache ALTER COLUMN id SET DEFAULT nextval('public.cohort_cache_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: company_integrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_integrations ALTER COLUMN id SET DEFAULT nextval('public.company_integrations_id_seq'::regclass);


--
-- Name: competitors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors ALTER COLUMN id SET DEFAULT nextval('public.competitors_id_seq'::regclass);


--
-- Name: complaint_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_history ALTER COLUMN id SET DEFAULT nextval('public.complaint_history_id_seq'::regclass);


--
-- Name: complaints id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints ALTER COLUMN id SET DEFAULT nextval('public.complaints_id_seq'::regclass);


--
-- Name: course_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress ALTER COLUMN id SET DEFAULT nextval('public.course_progress_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: customer_rfm_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rfm_history ALTER COLUMN id SET DEFAULT nextval('public.customer_rfm_history_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: debt_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debt_payments ALTER COLUMN id SET DEFAULT nextval('public.debt_payments_id_seq'::regclass);


--
-- Name: discounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts ALTER COLUMN id SET DEFAULT nextval('public.discounts_id_seq'::regclass);


--
-- Name: employee_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_adjustments ALTER COLUMN id SET DEFAULT nextval('public.employee_adjustments_id_seq'::regclass);


--
-- Name: event_greetings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_greetings ALTER COLUMN id SET DEFAULT nextval('public.event_greetings_id_seq'::regclass);


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);


--
-- Name: fixed_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets ALTER COLUMN id SET DEFAULT nextval('public.fixed_assets_id_seq'::regclass);


--
-- Name: funnel_inputs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_inputs ALTER COLUMN id SET DEFAULT nextval('public.funnel_inputs_id_seq'::regclass);


--
-- Name: inventory_audits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits ALTER COLUMN id SET DEFAULT nextval('public.inventory_audits_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: lessons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons ALTER COLUMN id SET DEFAULT nextval('public.lessons_id_seq'::regclass);


--
-- Name: loans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans ALTER COLUMN id SET DEFAULT nextval('public.loans_id_seq'::regclass);


--
-- Name: loyalty_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts ALTER COLUMN id SET DEFAULT nextval('public.loyalty_accounts_id_seq'::regclass);


--
-- Name: loyalty_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions ALTER COLUMN id SET DEFAULT nextval('public.loyalty_transactions_id_seq'::regclass);


--
-- Name: marketing_content id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content ALTER COLUMN id SET DEFAULT nextval('public.marketing_content_id_seq'::regclass);


--
-- Name: marketing_personas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_personas ALTER COLUMN id SET DEFAULT nextval('public.marketing_personas_id_seq'::regclass);


--
-- Name: notification_campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_campaigns ALTER COLUMN id SET DEFAULT nextval('public.notification_campaigns_id_seq'::regclass);


--
-- Name: payroll_liab id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_liab ALTER COLUMN id SET DEFAULT nextval('public.payroll_liab_id_seq'::regclass);


--
-- Name: penalty_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penalty_rules ALTER COLUMN id SET DEFAULT nextval('public.penalty_rules_id_seq'::regclass);


--
-- Name: police_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.police_alerts ALTER COLUMN id SET DEFAULT nextval('public.police_alerts_id_seq'::regclass);


--
-- Name: police_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.police_rules ALTER COLUMN id SET DEFAULT nextval('public.police_rules_id_seq'::regclass);


--
-- Name: product_stock id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock ALTER COLUMN id SET DEFAULT nextval('public.product_stock_id_seq'::regclass);


--
-- Name: product_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_types ALTER COLUMN id SET DEFAULT nextval('public.product_types_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_items_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: receiving_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_items ALTER COLUMN id SET DEFAULT nextval('public.receiving_items_id_seq'::regclass);


--
-- Name: receivings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivings ALTER COLUMN id SET DEFAULT nextval('public.receivings_id_seq'::regclass);


--
-- Name: referral_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes ALTER COLUMN id SET DEFAULT nextval('public.referral_codes_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: role_change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_log ALTER COLUMN id SET DEFAULT nextval('public.role_change_log_id_seq'::regclass);


--
-- Name: salaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salaries ALTER COLUMN id SET DEFAULT nextval('public.salaries_id_seq'::regclass);


--
-- Name: sale_edit_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_edit_requests ALTER COLUMN id SET DEFAULT nextval('public.sale_edit_requests_id_seq'::regclass);


--
-- Name: sales_scripts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_scripts ALTER COLUMN id SET DEFAULT nextval('public.sales_scripts_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: script_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_usage ALTER COLUMN id SET DEFAULT nextval('public.script_usage_id_seq'::regclass);


--
-- Name: shift_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates ALTER COLUMN id SET DEFAULT nextval('public.shift_templates_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: stock_income id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income ALTER COLUMN id SET DEFAULT nextval('public.stock_income_id_seq'::regclass);


--
-- Name: stock_outcome id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome ALTER COLUMN id SET DEFAULT nextval('public.stock_outcome_id_seq'::regclass);


--
-- Name: stock_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers ALTER COLUMN id SET DEFAULT nextval('public.stock_transfers_id_seq'::regclass);


--
-- Name: supplier_debt_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_debt_payments ALTER COLUMN id SET DEFAULT nextval('public.supplier_debt_payments_id_seq'::regclass);


--
-- Name: supplier_returns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns ALTER COLUMN id SET DEFAULT nextval('public.supplier_returns_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: task_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments ALTER COLUMN id SET DEFAULT nextval('public.task_comments_id_seq'::regclass);


--
-- Name: task_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_events ALTER COLUMN id SET DEFAULT nextval('public.task_events_id_seq'::regclass);


--
-- Name: task_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates ALTER COLUMN id SET DEFAULT nextval('public.task_templates_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: tax_obligations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_obligations ALTER COLUMN id SET DEFAULT nextval('public.tax_obligations_id_seq'::regclass);


--
-- Name: tax_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_payments ALTER COLUMN id SET DEFAULT nextval('public.tax_payments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: ab_points ab_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_points
    ADD CONSTRAINT ab_points_pkey PRIMARY KEY (id);


--
-- Name: absences absences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_log ai_chat_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log
    ADD CONSTRAINT ai_chat_log_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: anomalies anomalies_company_id_branch_id_date_metric_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomalies
    ADD CONSTRAINT anomalies_company_id_branch_id_date_metric_key UNIQUE (company_id, branch_id, date, metric);


--
-- Name: anomalies anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anomalies
    ADD CONSTRAINT anomalies_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: audit_items audit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: balance_entries balance_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balance_entries
    ADD CONSTRAINT balance_entries_pkey PRIMARY KEY (id);


--
-- Name: basket_pairs basket_pairs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.basket_pairs
    ADD CONSTRAINT basket_pairs_pkey PRIMARY KEY (id);


--
-- Name: bhi_daily bhi_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bhi_daily
    ADD CONSTRAINT bhi_daily_pkey PRIMARY KEY (company_id, date);


--
-- Name: bonus_transactions bonus_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus_transactions
    ADD CONSTRAINT bonus_transactions_pkey PRIMARY KEY (id);


--
-- Name: branch_daily_summary branch_daily_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_daily_summary
    ADD CONSTRAINT branch_daily_summary_pkey PRIMARY KEY (branch_id, date);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: bsc_departments bsc_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_departments
    ADD CONSTRAINT bsc_departments_pkey PRIMARY KEY (id);


--
-- Name: bsc_fact_values bsc_fact_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_fact_values
    ADD CONSTRAINT bsc_fact_values_pkey PRIMARY KEY (id);


--
-- Name: bsc_metrics bsc_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_metrics
    ADD CONSTRAINT bsc_metrics_pkey PRIMARY KEY (id);


--
-- Name: bsc_period_plans bsc_period_plans_metric_id_period_type_period_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_period_plans
    ADD CONSTRAINT bsc_period_plans_metric_id_period_type_period_no_key UNIQUE (metric_id, period_type, period_no);


--
-- Name: bsc_period_plans bsc_period_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_period_plans
    ADD CONSTRAINT bsc_period_plans_pkey PRIMARY KEY (id);


--
-- Name: bsc_strategies bsc_strategies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_strategies
    ADD CONSTRAINT bsc_strategies_pkey PRIMARY KEY (id);


--
-- Name: cash_categories cash_categories_branch_id_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_categories
    ADD CONSTRAINT cash_categories_branch_id_type_name_key UNIQUE (branch_id, type, name);


--
-- Name: cash_categories cash_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_categories
    ADD CONSTRAINT cash_categories_pkey PRIMARY KEY (id);


--
-- Name: cash_expense cash_expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_expense
    ADD CONSTRAINT cash_expense_pkey PRIMARY KEY (id);


--
-- Name: cash_income cash_income_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income
    ADD CONSTRAINT cash_income_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: channel_spend channel_spend_company_id_channel_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_spend
    ADD CONSTRAINT channel_spend_company_id_channel_month_key UNIQUE (company_id, channel, month);


--
-- Name: channel_spend channel_spend_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_spend
    ADD CONSTRAINT channel_spend_pkey PRIMARY KEY (id);


--
-- Name: checklist_completions checklist_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_completions
    ADD CONSTRAINT checklist_completions_pkey PRIMARY KEY (id);


--
-- Name: checklist_completions checklist_completions_template_id_branch_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_completions
    ADD CONSTRAINT checklist_completions_template_id_branch_id_date_key UNIQUE (template_id, branch_id, date);


--
-- Name: checklist_item_results checklist_item_results_completion_id_template_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_item_results
    ADD CONSTRAINT checklist_item_results_completion_id_template_item_id_key UNIQUE (completion_id, template_item_id);


--
-- Name: checklist_item_results checklist_item_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_item_results
    ADD CONSTRAINT checklist_item_results_pkey PRIMARY KEY (id);


--
-- Name: checklist_template_items checklist_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_template_items checklist_template_items_template_id_order_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_id_order_index_key UNIQUE (template_id, order_index);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: cohort_cache cohort_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cohort_cache
    ADD CONSTRAINT cohort_cache_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_bhi_config company_bhi_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bhi_config
    ADD CONSTRAINT company_bhi_config_pkey PRIMARY KEY (company_id);


--
-- Name: company_features company_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_features
    ADD CONSTRAINT company_features_pkey PRIMARY KEY (company_id, feature_key);


--
-- Name: company_integrations company_integrations_company_id_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_company_id_type_key UNIQUE (company_id, type);


--
-- Name: company_integrations company_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);


--
-- Name: complaint_history complaint_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_history
    ADD CONSTRAINT complaint_history_pkey PRIMARY KEY (id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: course_progress course_progress_employee_id_lesson_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_employee_id_lesson_id_key UNIQUE (employee_id, lesson_id);


--
-- Name: course_progress course_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: customer_bonuses customer_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_bonuses
    ADD CONSTRAINT customer_bonuses_pkey PRIMARY KEY (customer_id);


--
-- Name: customer_rfm_history customer_rfm_history_customer_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rfm_history
    ADD CONSTRAINT customer_rfm_history_customer_id_period_key UNIQUE (customer_id, period);


--
-- Name: customer_rfm_history customer_rfm_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rfm_history
    ADD CONSTRAINT customer_rfm_history_pkey PRIMARY KEY (id);


--
-- Name: customer_rfm customer_rfm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rfm
    ADD CONSTRAINT customer_rfm_pkey PRIMARY KEY (customer_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: debt_payments debt_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_pkey PRIMARY KEY (id);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (id);


--
-- Name: employee_adjustments employee_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_adjustments
    ADD CONSTRAINT employee_adjustments_pkey PRIMARY KEY (id);


--
-- Name: event_greetings event_greetings_customer_id_event_type_event_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_greetings
    ADD CONSTRAINT event_greetings_customer_id_event_type_event_year_key UNIQUE (customer_id, event_type, event_year);


--
-- Name: event_greetings event_greetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_greetings
    ADD CONSTRAINT event_greetings_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_currency_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_currency_date_key UNIQUE (currency, date);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: funnel_inputs funnel_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funnel_inputs
    ADD CONSTRAINT funnel_inputs_pkey PRIMARY KEY (id);


--
-- Name: inventory_audits inventory_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: marketing_content marketing_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_pkey PRIMARY KEY (id);


--
-- Name: marketing_personas marketing_personas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_personas
    ADD CONSTRAINT marketing_personas_pkey PRIMARY KEY (id);


--
-- Name: notification_campaigns notification_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_campaigns
    ADD CONSTRAINT notification_campaigns_pkey PRIMARY KEY (id);


--
-- Name: payroll_liab payroll_liab_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_liab
    ADD CONSTRAINT payroll_liab_pkey PRIMARY KEY (id);


--
-- Name: penalty_rules penalty_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penalty_rules
    ADD CONSTRAINT penalty_rules_pkey PRIMARY KEY (id);


--
-- Name: police_alerts police_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.police_alerts
    ADD CONSTRAINT police_alerts_pkey PRIMARY KEY (id);


--
-- Name: police_rules police_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.police_rules
    ADD CONSTRAINT police_rules_pkey PRIMARY KEY (id);


--
-- Name: product_stock product_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock
    ADD CONSTRAINT product_stock_pkey PRIMARY KEY (id);


--
-- Name: product_stock product_stock_product_branch_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock
    ADD CONSTRAINT product_stock_product_branch_uniq UNIQUE (product_id, branch_id);


--
-- Name: product_types product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);


--
-- Name: products products_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_barcode_key UNIQUE (barcode);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: receiving_items receiving_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_items
    ADD CONSTRAINT receiving_items_pkey PRIMARY KEY (id);


--
-- Name: receivings receivings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivings
    ADD CONSTRAINT receivings_pkey PRIMARY KEY (id);


--
-- Name: referral_codes referral_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_code_key UNIQUE (code);


--
-- Name: referral_codes referral_codes_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_customer_id_key UNIQUE (customer_id);


--
-- Name: referral_codes referral_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (id);


--
-- Name: referral_settings referral_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_settings
    ADD CONSTRAINT referral_settings_pkey PRIMARY KEY (company_id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: role_change_log role_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_log
    ADD CONSTRAINT role_change_log_pkey PRIMARY KEY (id);


--
-- Name: salaries salaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salaries
    ADD CONSTRAINT salaries_pkey PRIMARY KEY (id);


--
-- Name: sale_edit_requests sale_edit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_edit_requests
    ADD CONSTRAINT sale_edit_requests_pkey PRIMARY KEY (id);


--
-- Name: sales_scripts sales_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_scripts
    ADD CONSTRAINT sales_scripts_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: script_usage script_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_usage
    ADD CONSTRAINT script_usage_pkey PRIMARY KEY (id);


--
-- Name: shift_templates shift_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_templates
    ADD CONSTRAINT shift_templates_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: stock_income stock_income_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income
    ADD CONSTRAINT stock_income_pkey PRIMARY KEY (id);


--
-- Name: stock_outcome stock_outcome_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: supplier_debt_payments supplier_debt_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_debt_payments
    ADD CONSTRAINT supplier_debt_payments_pkey PRIMARY KEY (id);


--
-- Name: supplier_returns supplier_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT supplier_returns_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_events task_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_events
    ADD CONSTRAINT task_events_pkey PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tax_obligations tax_obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT tax_obligations_pkey PRIMARY KEY (id);


--
-- Name: tax_payments tax_payments_company_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_payments
    ADD CONSTRAINT tax_payments_company_id_period_key UNIQUE (company_id, period);


--
-- Name: tax_payments tax_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_payments
    ADD CONSTRAINT tax_payments_pkey PRIMARY KEY (id);


--
-- Name: tax_settings tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_pkey PRIMARY KEY (company_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wow_bep wow_bep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wow_bep
    ADD CONSTRAINT wow_bep_pkey PRIMARY KEY (id);


--
-- Name: ab_points_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ab_points_scope_idx ON public.ab_points USING btree (company_id, period, captured_at DESC);


--
-- Name: idx_absences_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_branch ON public.absences USING btree (branch_id);


--
-- Name: idx_absences_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_company ON public.absences USING btree (company_id);


--
-- Name: idx_absences_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_dates ON public.absences USING btree (start_date, end_date);


--
-- Name: idx_absences_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_employee ON public.absences USING btree (employee_id);


--
-- Name: idx_absences_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_status ON public.absences USING btree (status);


--
-- Name: idx_ai_chat_log_co_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_log_co_user ON public.ai_chat_log USING btree (company_id, user_id, created_at DESC);


--
-- Name: idx_alerts_company_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_company_branch_status ON public.alerts USING btree (company_id, branch_id, status, severity);


--
-- Name: idx_alerts_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_company_status ON public.alerts USING btree (company_id, status);


--
-- Name: idx_anomalies_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomalies_branch ON public.anomalies USING btree (branch_id, date DESC);


--
-- Name: idx_anomalies_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomalies_company_date ON public.anomalies USING btree (company_id, date DESC);


--
-- Name: idx_attendance_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_branch ON public.attendance USING btree (branch_id);


--
-- Name: idx_attendance_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_company ON public.attendance USING btree (company_id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (company_id, work_date);


--
-- Name: idx_attendance_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_employee ON public.attendance USING btree (employee_id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_branch_date ON public.audit_log USING btree (branch_id, created_at DESC);


--
-- Name: idx_audit_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_company_date ON public.audit_log USING btree (company_id, created_at DESC);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_items_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_items_audit ON public.audit_items USING btree (audit_id);


--
-- Name: idx_audit_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_module ON public.audit_log USING btree (company_id, module);


--
-- Name: idx_audit_suspicious; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_suspicious ON public.audit_log USING btree (company_id, is_suspicious) WHERE (is_suspicious = true);


--
-- Name: idx_audit_user_ej; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user_ej ON public.audit_log USING btree (company_id, user_id);


--
-- Name: idx_audit_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user_time ON public.audit_log USING btree (user_id, created_at DESC);


--
-- Name: idx_balance_entries_company_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_entries_company_period ON public.balance_entries USING btree (company_id, branch_id, period DESC);


--
-- Name: idx_basket_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_basket_company_branch ON public.basket_pairs USING btree (company_id, branch_id);


--
-- Name: idx_basket_recommend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_basket_recommend ON public.basket_pairs USING btree (company_id, branch_id, product_a_id, product_b_id);


--
-- Name: idx_bhi_daily_co; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bhi_daily_co ON public.bhi_daily USING btree (company_id, date);


--
-- Name: idx_bonustx_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonustx_company ON public.bonus_transactions USING btree (company_id);


--
-- Name: idx_bonustx_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bonustx_customer ON public.bonus_transactions USING btree (customer_id, created_at DESC);


--
-- Name: idx_bsc_dept_strat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsc_dept_strat ON public.bsc_departments USING btree (strategy_id, display_order);


--
-- Name: idx_bsc_fact_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsc_fact_metric ON public.bsc_fact_values USING btree (metric_id, fact_date);


--
-- Name: idx_bsc_metric_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsc_metric_dept ON public.bsc_metrics USING btree (department_id, display_order);


--
-- Name: idx_bsc_pplan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsc_pplan ON public.bsc_period_plans USING btree (metric_id, period_type, period_no);


--
-- Name: idx_bsc_strat_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsc_strat_company ON public.bsc_strategies USING btree (company_id, created_at DESC);


--
-- Name: idx_cash_expense_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_expense_branch_id ON public.cash_expense USING btree (branch_id);


--
-- Name: idx_cash_expense_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_expense_created_at ON public.cash_expense USING btree (created_at DESC);


--
-- Name: idx_cash_income_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_income_branch_id ON public.cash_income USING btree (branch_id);


--
-- Name: idx_cash_income_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_income_created_at ON public.cash_income USING btree (created_at DESC);


--
-- Name: idx_cash_income_outcome_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_income_outcome_id ON public.cash_income USING btree (outcome_id);


--
-- Name: idx_cash_income_unsettled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_income_unsettled ON public.cash_income USING btree (branch_id, is_settled) WHERE (is_settled = false);


--
-- Name: idx_cbonuses_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cbonuses_company ON public.customer_bonuses USING btree (company_id);


--
-- Name: idx_ce_branch_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ce_branch_created ON public.cash_expense USING btree (branch_id, created_at);


--
-- Name: idx_channel_spend_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_spend_company ON public.channel_spend USING btree (company_id, month);


--
-- Name: idx_ci_branch_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_branch_created ON public.cash_income USING btree (branch_id, created_at);


--
-- Name: idx_cl_completions_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cl_completions_branch_date ON public.checklist_completions USING btree (branch_id, date DESC);


--
-- Name: idx_cl_item_results_completion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cl_item_results_completion ON public.checklist_item_results USING btree (completion_id);


--
-- Name: idx_cl_tpl_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cl_tpl_company ON public.checklist_templates USING btree (company_id, is_active);


--
-- Name: idx_cl_tpl_items_tpl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cl_tpl_items_tpl ON public.checklist_template_items USING btree (template_id, order_index);


--
-- Name: idx_cohort_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_company_branch ON public.cohort_cache USING btree (company_id, branch_id, cohort_month);


--
-- Name: idx_comp_company_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_company_branch ON public.complaints USING btree (company_id, branch_id, status);


--
-- Name: idx_comp_company_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_company_created ON public.complaints USING btree (company_id, created_at);


--
-- Name: idx_comp_hist_complaint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comp_hist_complaint ON public.complaint_history USING btree (complaint_id, created_at);


--
-- Name: idx_company_integrations_co; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_integrations_co ON public.company_integrations USING btree (company_id);


--
-- Name: idx_competitors_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitors_company ON public.competitors USING btree (company_id);


--
-- Name: idx_course_progress_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_progress_emp ON public.course_progress USING btree (employee_id);


--
-- Name: idx_course_progress_lesson; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_progress_lesson ON public.course_progress USING btree (lesson_id);


--
-- Name: idx_courses_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_company ON public.courses USING btree (company_id);


--
-- Name: idx_courses_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_position ON public.courses USING btree (company_id, "position");


--
-- Name: idx_customers_birth; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_birth ON public.customers USING btree (company_id) WHERE (birth_date IS NOT NULL);


--
-- Name: idx_customers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company ON public.customers USING btree (company_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone) WHERE (deleted_at IS NULL);


--
-- Name: idx_debt_payments_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_debt_payments_outcome ON public.debt_payments USING btree (outcome_id);


--
-- Name: idx_discounts_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discounts_branch ON public.discounts USING btree (branch_id);


--
-- Name: idx_discounts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discounts_company ON public.discounts USING btree (company_id);


--
-- Name: idx_edit_req_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edit_req_outcome ON public.sale_edit_requests USING btree (outcome_id);


--
-- Name: idx_edit_req_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edit_req_pending ON public.sale_edit_requests USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_emp_adj_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_adj_branch ON public.employee_adjustments USING btree (branch_id);


--
-- Name: idx_emp_adj_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_adj_company ON public.employee_adjustments USING btree (company_id, created_at);


--
-- Name: idx_emp_adj_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_adj_employee ON public.employee_adjustments USING btree (employee_id);


--
-- Name: idx_event_greet_co; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_greet_co ON public.event_greetings USING btree (company_id, event_type, event_year);


--
-- Name: idx_fixed_assets_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixed_assets_company ON public.fixed_assets USING btree (company_id);


--
-- Name: idx_funnel_inputs_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_funnel_inputs_company ON public.funnel_inputs USING btree (company_id, period);


--
-- Name: idx_inventory_audits_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_audits_company ON public.inventory_audits USING btree (company_id);


--
-- Name: idx_leads_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_branch ON public.leads USING btree (branch_id);


--
-- Name: idx_leads_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_company ON public.leads USING btree (company_id);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_lessons_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lessons_course ON public.lessons USING btree (course_id, ord);


--
-- Name: idx_loans_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loans_company ON public.loans USING btree (company_id);


--
-- Name: idx_marketing_content_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_content_company ON public.marketing_content USING btree (company_id);


--
-- Name: idx_marketing_content_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_content_scheduled ON public.marketing_content USING btree (company_id, scheduled_for);


--
-- Name: idx_marketing_personas_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_personas_company ON public.marketing_personas USING btree (company_id);


--
-- Name: idx_notif_campaigns_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_campaigns_branch ON public.notification_campaigns USING btree (branch_id);


--
-- Name: idx_notif_campaigns_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_campaigns_company ON public.notification_campaigns USING btree (company_id, created_at DESC);


--
-- Name: idx_outcome_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outcome_customer ON public.stock_outcome USING btree (customer_id);


--
-- Name: idx_outcome_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outcome_type ON public.stock_outcome USING btree (outcome_type);


--
-- Name: idx_outcome_unpaid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outcome_unpaid ON public.stock_outcome USING btree (branch_id, payment_status) WHERE ((payment_status)::text <> 'paid'::text);


--
-- Name: idx_payroll_liab_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_liab_company ON public.payroll_liab USING btree (company_id);


--
-- Name: idx_penalty_rules_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_penalty_rules_company ON public.penalty_rules USING btree (company_id);


--
-- Name: idx_po_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_po_company ON public.purchase_orders USING btree (company_id);


--
-- Name: idx_poi_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_poi_order ON public.purchase_order_items USING btree (order_id);


--
-- Name: idx_police_alerts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_police_alerts_company ON public.police_alerts USING btree (company_id, status);


--
-- Name: idx_police_alerts_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_police_alerts_key ON public.police_alerts USING btree (company_id, rule_code);


--
-- Name: idx_police_rules_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_police_rules_company ON public.police_rules USING btree (company_id);


--
-- Name: idx_product_stock_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_stock_branch ON public.product_stock USING btree (branch_id);


--
-- Name: idx_products_alive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_alive ON public.products USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_branch_id ON public.products USING btree (branch_id);


--
-- Name: idx_products_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_company ON public.products USING btree (company_id);


--
-- Name: idx_products_name_ru_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name_ru_lower ON public.products USING btree (lower((name_ru)::text) text_pattern_ops);


--
-- Name: idx_ps_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ps_branch ON public.product_stock USING btree (branch_id);


--
-- Name: idx_receiving_items_rec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receiving_items_rec ON public.receiving_items USING btree (receiving_id);


--
-- Name: idx_receivings_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivings_branch ON public.receivings USING btree (branch_id);


--
-- Name: idx_receivings_company_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivings_company_created ON public.receivings USING btree (company_id, created_at);


--
-- Name: idx_refcodes_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refcodes_company ON public.referral_codes USING btree (company_id);


--
-- Name: idx_referrals_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_company ON public.referrals USING btree (company_id, status);


--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);


--
-- Name: idx_reviews_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_branch ON public.reviews USING btree (branch_id);


--
-- Name: idx_reviews_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_company ON public.reviews USING btree (company_id);


--
-- Name: idx_reviews_company_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_company_source ON public.reviews USING btree (company_id, source);


--
-- Name: idx_reviews_company_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_company_type ON public.reviews USING btree (company_id, type);


--
-- Name: idx_rfm_company_segment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfm_company_segment ON public.customer_rfm USING btree (company_id, segment);


--
-- Name: idx_rfm_hist_company_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfm_hist_company_period ON public.customer_rfm_history USING btree (company_id, period);


--
-- Name: idx_sales_scripts_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_scripts_company ON public.sales_scripts USING btree (company_id);


--
-- Name: idx_schedules_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_branch ON public.schedules USING btree (branch_id);


--
-- Name: idx_schedules_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_company_date ON public.schedules USING btree (company_id, work_date);


--
-- Name: idx_schedules_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_employee ON public.schedules USING btree (employee_id);


--
-- Name: idx_script_usage_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_script_usage_created ON public.script_usage USING btree (created_at);


--
-- Name: idx_script_usage_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_script_usage_script ON public.script_usage USING btree (script_id);


--
-- Name: idx_shift_templates_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_templates_company ON public.shift_templates USING btree (company_id);


--
-- Name: idx_shifts_branch_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_branch_time ON public.shifts USING btree (branch_id, opened_at DESC);


--
-- Name: idx_so_branch_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_so_branch_status_created ON public.stock_outcome USING btree (branch_id, status, created_at);


--
-- Name: idx_so_customer_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_so_customer_status_created ON public.stock_outcome USING btree (customer_id, status, created_at);


--
-- Name: idx_so_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_so_product ON public.stock_outcome USING btree (product_id);


--
-- Name: idx_stock_income_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_income_branch_id ON public.stock_income USING btree (branch_id);


--
-- Name: idx_stock_income_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_income_created_at ON public.stock_income USING btree (created_at DESC);


--
-- Name: idx_stock_income_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_income_product_id ON public.stock_income USING btree (product_id);


--
-- Name: idx_stock_income_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_income_supplier ON public.stock_income USING btree (supplier_id);


--
-- Name: idx_stock_income_unpaid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_income_unpaid ON public.stock_income USING btree (supplier_id, payment_status) WHERE ((payment_status)::text <> 'paid'::text);


--
-- Name: idx_stock_outcome_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_outcome_branch_id ON public.stock_outcome USING btree (branch_id);


--
-- Name: idx_stock_outcome_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_outcome_created_at ON public.stock_outcome USING btree (created_at DESC);


--
-- Name: idx_stock_outcome_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_outcome_product_id ON public.stock_outcome USING btree (product_id);


--
-- Name: idx_stock_outcome_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_outcome_status ON public.stock_outcome USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_stock_transfers_branches; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfers_branches ON public.stock_transfers USING btree (from_branch, to_branch);


--
-- Name: idx_stock_transfers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfers_company ON public.stock_transfers USING btree (company_id, sent_at DESC);


--
-- Name: idx_sup_debt_payments_income; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sup_debt_payments_income ON public.supplier_debt_payments USING btree (income_id);


--
-- Name: idx_sup_returns_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sup_returns_company ON public.supplier_returns USING btree (company_id, branch_id, created_at);


--
-- Name: idx_sup_returns_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sup_returns_supplier ON public.supplier_returns USING btree (supplier_id);


--
-- Name: idx_suppliers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_company ON public.suppliers USING btree (company_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_task_comments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_comments_task ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_events_inbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_events_inbox ON public.task_events USING btree (recipient_id, read_at, created_at DESC);


--
-- Name: idx_task_events_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_events_task ON public.task_events USING btree (task_id, created_at);


--
-- Name: idx_task_templates_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_branch ON public.task_templates USING btree (branch_id);


--
-- Name: idx_task_templates_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_templates_company ON public.task_templates USING btree (company_id, is_active);


--
-- Name: idx_tasks_assignee_status_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_status_due ON public.tasks USING btree (assignee_id, status, due_date);


--
-- Name: idx_tasks_branch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_branch_status ON public.tasks USING btree (company_id, branch_id, status);


--
-- Name: idx_tasks_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_company ON public.tasks USING btree (company_id);


--
-- Name: idx_tasks_due_date_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_date_active ON public.tasks USING btree (company_id, due_date) WHERE (status = ANY (ARRAY['todo'::text, 'in_progress'::text]));


--
-- Name: idx_tax_obligations_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_obligations_company ON public.tax_obligations USING btree (company_id);


--
-- Name: loyalty_accounts_company_customer_uk; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_accounts_company_customer_uk ON public.loyalty_accounts USING btree (company_id, customer_id);


--
-- Name: loyalty_accounts_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_accounts_company_idx ON public.loyalty_accounts USING btree (company_id);


--
-- Name: loyalty_transactions_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_transactions_account_idx ON public.loyalty_transactions USING btree (account_id);


--
-- Name: one_founder_per_company; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_founder_per_company ON public.users USING btree (company_id) WHERE (((role)::text = 'founder'::text) AND (company_id IS NOT NULL));


--
-- Name: one_gen_dir_per_company; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_gen_dir_per_company ON public.users USING btree (company_id) WHERE (((role)::text = 'gen_dir'::text) AND (company_id IS NOT NULL));


--
-- Name: one_open_shift_per_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_open_shift_per_branch ON public.shifts USING btree (branch_id) WHERE ((status)::text = 'open'::text);


--
-- Name: salaries_company_employee_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX salaries_company_employee_period_idx ON public.salaries USING btree (company_id, employee_id, period);


--
-- Name: salaries_company_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salaries_company_period_idx ON public.salaries USING btree (company_id, period);


--
-- Name: salaries_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX salaries_status_idx ON public.salaries USING btree (status);


--
-- Name: uq_alerts_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_alerts_source ON public.alerts USING btree (company_id, module, source_table, source_id) WHERE ((source_table IS NOT NULL) AND (source_id IS NOT NULL));


--
-- Name: uq_basket_company_branch_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_basket_company_branch_pair ON public.basket_pairs USING btree (company_id, branch_id, product_a_id, product_b_id) WHERE (branch_id IS NOT NULL);


--
-- Name: uq_basket_company_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_basket_company_pair ON public.basket_pairs USING btree (company_id, product_a_id, product_b_id) WHERE (branch_id IS NULL);


--
-- Name: uq_cohort_company_branch_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cohort_company_branch_month ON public.cohort_cache USING btree (company_id, branch_id, cohort_month) WHERE (branch_id IS NOT NULL);


--
-- Name: uq_cohort_company_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cohort_company_month ON public.cohort_cache USING btree (company_id, cohort_month) WHERE (branch_id IS NULL);


--
-- Name: uq_funnel_inputs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_funnel_inputs_period ON public.funnel_inputs USING btree (company_id, COALESCE(branch_id, 0), period);


--
-- Name: uq_tasks_template_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tasks_template_date ON public.tasks USING btree (source_template_id, due_date) WHERE (source_template_id IS NOT NULL);


--
-- Name: ai_chat_log ai_chat_log_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log
    ADD CONSTRAINT ai_chat_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: ai_chat_log ai_chat_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log
    ADD CONSTRAINT ai_chat_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_items audit_items_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_items
    ADD CONSTRAINT audit_items_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.inventory_audits(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bhi_daily bhi_daily_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bhi_daily
    ADD CONSTRAINT bhi_daily_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: branches branches_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: branches branches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bsc_departments bsc_departments_strategy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_departments
    ADD CONSTRAINT bsc_departments_strategy_id_fkey FOREIGN KEY (strategy_id) REFERENCES public.bsc_strategies(id) ON DELETE CASCADE;


--
-- Name: bsc_fact_values bsc_fact_values_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_fact_values
    ADD CONSTRAINT bsc_fact_values_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.bsc_metrics(id) ON DELETE CASCADE;


--
-- Name: bsc_metrics bsc_metrics_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_metrics
    ADD CONSTRAINT bsc_metrics_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.bsc_departments(id) ON DELETE CASCADE;


--
-- Name: bsc_period_plans bsc_period_plans_metric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bsc_period_plans
    ADD CONSTRAINT bsc_period_plans_metric_id_fkey FOREIGN KEY (metric_id) REFERENCES public.bsc_metrics(id) ON DELETE CASCADE;


--
-- Name: cash_categories cash_categories_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_categories
    ADD CONSTRAINT cash_categories_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: cash_categories cash_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_categories
    ADD CONSTRAINT cash_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cash_expense cash_expense_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_expense
    ADD CONSTRAINT cash_expense_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: cash_expense cash_expense_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_expense
    ADD CONSTRAINT cash_expense_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cash_income cash_income_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income
    ADD CONSTRAINT cash_income_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: cash_income cash_income_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income
    ADD CONSTRAINT cash_income_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cash_income cash_income_outcome_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income
    ADD CONSTRAINT cash_income_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.stock_outcome(id) ON DELETE CASCADE;


--
-- Name: cash_income cash_income_settled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_income
    ADD CONSTRAINT cash_income_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: channel_spend channel_spend_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_spend
    ADD CONSTRAINT channel_spend_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: channel_spend channel_spend_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_spend
    ADD CONSTRAINT channel_spend_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: checklist_completions checklist_completions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_completions
    ADD CONSTRAINT checklist_completions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: checklist_item_results checklist_item_results_completion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_item_results
    ADD CONSTRAINT checklist_item_results_completion_id_fkey FOREIGN KEY (completion_id) REFERENCES public.checklist_completions(id) ON DELETE CASCADE;


--
-- Name: checklist_template_items checklist_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_template_items
    ADD CONSTRAINT checklist_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: company_bhi_config company_bhi_config_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bhi_config
    ADD CONSTRAINT company_bhi_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_bhi_config company_bhi_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bhi_config
    ADD CONSTRAINT company_bhi_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_features company_features_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_features
    ADD CONSTRAINT company_features_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_features company_features_enabled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_features
    ADD CONSTRAINT company_features_enabled_by_fkey FOREIGN KEY (enabled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: company_integrations company_integrations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_integrations company_integrations_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_integrations
    ADD CONSTRAINT company_integrations_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: complaint_history complaint_history_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_history
    ADD CONSTRAINT complaint_history_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: course_progress course_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_progress
    ADD CONSTRAINT course_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customers customers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: debt_payments debt_payments_outcome_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.stock_outcome(id) ON DELETE CASCADE;


--
-- Name: debt_payments debt_payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.debt_payments
    ADD CONSTRAINT debt_payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: event_greetings event_greetings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_greetings
    ADD CONSTRAINT event_greetings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: fixed_assets fixed_assets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: fixed_assets fixed_assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lessons lessons_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: loans loans_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: loans loans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: loyalty_transactions loyalty_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE;


--
-- Name: marketing_content marketing_content_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: marketing_content marketing_content_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketing_content marketing_content_persona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_persona_id_fkey FOREIGN KEY (persona_id) REFERENCES public.marketing_personas(id) ON DELETE SET NULL;


--
-- Name: marketing_personas marketing_personas_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_personas
    ADD CONSTRAINT marketing_personas_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: marketing_personas marketing_personas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_personas
    ADD CONSTRAINT marketing_personas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payroll_liab payroll_liab_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_liab
    ADD CONSTRAINT payroll_liab_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: payroll_liab payroll_liab_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_liab
    ADD CONSTRAINT payroll_liab_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product_stock product_stock_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock
    ADD CONSTRAINT product_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: product_stock product_stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock
    ADD CONSTRAINT product_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: products products_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.product_types(id) ON DELETE SET NULL;


--
-- Name: purchase_order_items purchase_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: receiving_items receiving_items_receiving_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receiving_items
    ADD CONSTRAINT receiving_items_receiving_id_fkey FOREIGN KEY (receiving_id) REFERENCES public.receivings(id) ON DELETE CASCADE;


--
-- Name: role_change_log role_change_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_log
    ADD CONSTRAINT role_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_change_log role_change_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_change_log
    ADD CONSTRAINT role_change_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sale_edit_requests sale_edit_requests_outcome_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_edit_requests
    ADD CONSTRAINT sale_edit_requests_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.stock_outcome(id) ON DELETE CASCADE;


--
-- Name: sale_edit_requests sale_edit_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_edit_requests
    ADD CONSTRAINT sale_edit_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: sale_edit_requests sale_edit_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_edit_requests
    ADD CONSTRAINT sale_edit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: script_usage script_usage_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.script_usage
    ADD CONSTRAINT script_usage_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.sales_scripts(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: shifts shifts_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id);


--
-- Name: stock_income stock_income_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income
    ADD CONSTRAINT stock_income_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_income stock_income_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income
    ADD CONSTRAINT stock_income_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_income stock_income_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income
    ADD CONSTRAINT stock_income_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_income stock_income_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_income
    ADD CONSTRAINT stock_income_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: stock_outcome stock_outcome_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: stock_outcome stock_outcome_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_outcome stock_outcome_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_outcome stock_outcome_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: stock_outcome stock_outcome_original_outcome_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_original_outcome_id_fkey FOREIGN KEY (original_outcome_id) REFERENCES public.stock_outcome(id) ON DELETE SET NULL;


--
-- Name: stock_outcome stock_outcome_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_outcome stock_outcome_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_outcome
    ADD CONSTRAINT stock_outcome_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: supplier_debt_payments supplier_debt_payments_income_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_debt_payments
    ADD CONSTRAINT supplier_debt_payments_income_id_fkey FOREIGN KEY (income_id) REFERENCES public.stock_income(id) ON DELETE CASCADE;


--
-- Name: supplier_debt_payments supplier_debt_payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_debt_payments
    ADD CONSTRAINT supplier_debt_payments_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: suppliers suppliers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tax_obligations tax_obligations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT tax_obligations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: tax_obligations tax_obligations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT tax_obligations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict KrbdkfilgGvSzq4jgXETJyoo8XOJn1UFkgLY9cpqKxD84I5hzb6LGY6k0QlPAhQ

