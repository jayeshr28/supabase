import { PermissionAction } from '@supabase/shared-types/out/constants'
import { observer } from 'mobx-react-lite'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Button,
  IconAlertCircle,
  IconAlertTriangle,
  IconHelpCircle,
  Listbox,
  Loading,
  Modal,
  Toggle,
} from 'ui'

import { SpendCapModal } from 'components/interfaces/BillingV2'
import { useOrganizationBillingMigrationMutation } from 'data/organizations/organization-migrate-billing-mutation'
import { useOrganizationBillingMigrationPreview } from 'data/organizations/organization-migrate-billing-preview-query'
import { useCheckPermissions, useSelectedOrganization, useStore } from 'hooks'
import { PRICING_TIER_LABELS_ORG } from 'lib/constants'
import PaymentMethodSelection from '../BillingSettingsV2/Subscription/PaymentMethodSelection'
import InformationBox from 'components/ui/InformationBox'

const MigrateOrganizationBillingButton = observer(() => {
  const { ui } = useStore()
  const router = useRouter()
  const organization = useSelectedOrganization()

  const [isOpen, setIsOpen] = useState(false)
  const [tier, setTier] = useState('')
  const [showSpendCapHelperModal, setShowSpendCapHelperModal] = useState(false)
  const [isSpendCapEnabled, setIsSpendCapEnabled] = useState(true)
  const [paymentMethodId, setPaymentMethodId] = useState('')

  const dbTier = useMemo(() => {
    if (tier === '') return ''
    if (tier === 'PRO' && !isSpendCapEnabled) {
      return `tier_payg`
    } else {
      return `tier_` + tier.toLocaleLowerCase()
    }
  }, [tier, isSpendCapEnabled])

  const {
    error: migrationError,
    mutate: migrateBilling,
    isLoading: isMigrating,
  } = useOrganizationBillingMigrationMutation({
    onSuccess: () => {
      ui.setNotification({
        message: 'Successfully migrated to organization-level billing',
        category: 'success',
        duration: 5000,
      })
      router.push('/projects')
      setIsOpen(false)
    },
  })

  const {
    data: migrationPreviewData,
    error: migrationPreviewError,
    isLoading: migrationPreviewIsLoading,
    remove,
    refetch: previewMigration,
  } = useOrganizationBillingMigrationPreview(
    { tier: dbTier, organizationSlug: organization?.slug },
    { enabled: false, refetchOnWindowFocus: false }
  )

  useEffect(() => {
    if (dbTier) {
      previewMigration()
    }
  }, [dbTier])

  useEffect(() => {
    if (isOpen) {
      // reset state
      setTier('')
    } else {
      // Invalidate cache
      remove()
    }
  }, [isOpen])

  const canMigrateOrganization = useCheckPermissions(PermissionAction.UPDATE, 'organizations')

  const toggle = () => {
    setIsOpen(!isOpen)
  }

  const onConfirmMigrate = async () => {
    if (!tier) return
    if (!canMigrateOrganization) {
      return ui.setNotification({
        category: 'error',
        message: 'You do not have the required permissions to migrate this organization',
      })
    }
    migrateBilling({ organizationSlug: organization?.slug, tier: dbTier, paymentMethodId })
  }

  return (
    <>
      <div>
        <Button loading={!organization?.slug} onClick={() => setIsOpen(true)} type="primary">
          Migrate organization
        </Button>
      </div>
      <Modal
        closable
        hideFooter
        size="xlarge"
        visible={isOpen}
        onCancel={toggle}
        header={
          <div className="flex items-baseline gap-2">
            <h5 className="text-sm text-scale-1200">Migrate organization</h5>
          </div>
        }
      >
        <div className="space-y-4 py-3">
          <Modal.Content>
            <div className="space-y-2">
              <Alert_Shadcn_ variant="destructive">
                <IconAlertCircle strokeWidth={2} />
                <AlertTitle_Shadcn_>Irreversible</AlertTitle_Shadcn_>
                <AlertDescription_Shadcn_>
                  Once migrated to the new organization-level billing, you cannot go back to the old
                  project-level billing.
                </AlertDescription_Shadcn_>
              </Alert_Shadcn_>

              {migrationPreviewData?.addons_to_be_removed &&
                migrationPreviewData.addons_to_be_removed.length > 0 && (
                  <Alert_Shadcn_ variant="warning">
                    <IconAlertTriangle strokeWidth={2} />
                    <AlertTitle_Shadcn_>Project addons will be removed</AlertTitle_Shadcn_>
                    <AlertDescription_Shadcn_>
                      <div>
                        The following project addons will be removed when downgrading
                        <ul className="list-disc list-inside pl-4">
                          {migrationPreviewData.addons_to_be_removed.map((addon) =>
                            addon.addons.map((variant) => (
                              <li key={`${addon.projectRef}-${variant.variant}`}>
                                {variant.type === 'pitr'
                                  ? 'PITR - '
                                  : variant.type === 'compute_instance'
                                  ? 'Compute Instance - '
                                  : ''}
                                {variant.name} for project {addon.projectName || addon.projectRef}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </AlertDescription_Shadcn_>
                  </Alert_Shadcn_>
                )}
            </div>
          </Modal.Content>
          <Modal.Separator />
          <Modal.Content>
            <div className="text-scale-1000 text-sm space-y-2">
              <p>
                Migrating to new organization-level billing combines subscriptions for all projects
                in the organization into a single subscription.
              </p>

              <p>
                For a detailed breakdown of changes, see{' '}
                <Link href="https://www.notion.so/supabase/Org-Level-Billing-Public-Docs-f059a154beb743a19199d05bab4acb08">
                  <a target="_blank" rel="noreferrer" className="underline">
                    Billing Migration Docs
                  </a>
                </Link>
                . To transfer projects to a different organization, visit{' '}
                <Link href="/projects/_/settings/general">
                  <a target="_blank" rel="noreferrer" className="underline">
                    General settings
                  </a>
                </Link>
                .
              </p>
            </div>
          </Modal.Content>
          <Modal.Separator />
          <Modal.Content>
            <Listbox
              id="tier"
              label="Organization Pricing Plan"
              layout="horizontal"
              value={tier}
              onChange={setTier}
              className="flex items-center"
            >
              <Listbox.Option label="Select plan" value="" disabled className="hidden">
                Select Plan
              </Listbox.Option>
              {Object.entries(PRICING_TIER_LABELS_ORG).map(([k, v]) => {
                return (
                  <Listbox.Option key={k} label={v} value={k}>
                    {v}
                  </Listbox.Option>
                )
              })}
            </Listbox>

            <p className="text-sm text-scale-1000 mt-4">
              The pricing plan, along with included usage limits will apply to your entire
              organization. See{' '}
              <a
                className="underline"
                target="_blank"
                rel="noreferrer"
                href="https://supabase.com/pricing"
              >
                Pricing
              </a>{' '}
              for more details. Please contact support if you are an Enterprise customer.
            </p>

            {tier !== '' && tier !== 'FREE' && (
              <div className="my-2 space-y-1 pb-4">
                <p className="text-sm text-scale-1000">
                  Paid plans come with one compute instance included. Additional projects will at
                  least cost the compute instance hours used (min $7/month). See{' '}
                  <Link href="https://www.notion.so/supabase/Organization-Level-Billing-707638e35c92489995dc3ac991a324d1">
                    <a target="_blank" rel="noreferrer" className="underline">
                      Compute Instance Usage Billing
                    </a>
                  </Link>{' '}
                  for more details.
                </p>
              </div>
            )}
          </Modal.Content>

          <Modal.Separator />

          {tier === 'PRO' && (
            <>
              <Modal.Content>
                <div className="mt-4 grid grid-cols-8 gap-x-8 gap-y-2">
                  <div className="space-y-2 col-span-4">
                    <p className="text-sm flex items-center gap-4">
                      Enable spend cap{' '}
                      <IconHelpCircle
                        size={16}
                        strokeWidth={1.5}
                        className="transition opacity-50 cursor-pointer hover:opacity-100"
                        onClick={() => setShowSpendCapHelperModal(true)}
                      />
                    </p>
                  </div>

                  <div className="col-span-8">
                    <Toggle
                      id="isSpendCapEnabled"
                      layout="vertical"
                      checked={isSpendCapEnabled}
                      onChange={() => setIsSpendCapEnabled(!isSpendCapEnabled)}
                    />
                  </div>

                  <div className="col-span-12">
                    <p className="text-sm text-scale-1000">
                      When enabled, usage is limited to the plan's quota, with restrictions when
                      limits are exceeded. To scale beyond Pro limits without restrictions, disable
                      the spend cap and pay for over-usage beyond the quota.
                    </p>
                  </div>

                  <SpendCapModal
                    visible={showSpendCapHelperModal}
                    onHide={() => setShowSpendCapHelperModal(false)}
                  />
                </div>
              </Modal.Content>
              <Modal.Separator />
            </>
          )}

          {tier && tier !== 'FREE' && (
            <>
              <Modal.Content>
                <PaymentMethodSelection
                  layout="horizontal"
                  onSelectPaymentMethod={(pm) => setPaymentMethodId(pm)}
                />
              </Modal.Content>
              <Modal.Separator />
            </>
          )}

          <Modal.Content>
            <Loading active={tier !== '' && migrationPreviewIsLoading}>
              {migrationPreviewError && (
                <Alert_Shadcn_ variant="destructive">
                  <IconAlertCircle strokeWidth={2} />
                  <AlertTitle_Shadcn_>Organization cannot be migrated</AlertTitle_Shadcn_>
                  <AlertDescription_Shadcn_>
                    {migrationPreviewError.message}
                  </AlertDescription_Shadcn_>
                </Alert_Shadcn_>
              )}
            </Loading>

            {migrationError && (
              <Alert_Shadcn_ variant="destructive">
                <IconAlertCircle strokeWidth={2} />
                <AlertTitle_Shadcn_>Organization cannot be migrated</AlertTitle_Shadcn_>
                <AlertDescription_Shadcn_>{migrationError.message}</AlertDescription_Shadcn_>
              </Alert_Shadcn_>
            )}
          </Modal.Content>

          {!migrationPreviewIsLoading && migrationPreviewData && dbTier !== 'tier_free' && (
            <Modal.Content>
              <InformationBox
                defaultVisibility={false}
                title={
                  <span>
                    Estimated monthly price is $
                    {migrationPreviewData.monthly_invoice_breakdown.reduce(
                      (prev, cur) => prev + cur.total_price,
                      0
                    )}{' '}
                    + usage
                  </span>
                }
                hideCollapse={false}
                description={
                  <div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 font-normal text-left text-sm text-scale-1000 w-1/2">
                            Item
                          </th>
                          <th className="py-2 font-normal text-left text-sm text-scale-1000">
                            Count
                          </th>
                          <th className="py-2 font-normal text-left text-sm text-scale-1000">
                            Unit price
                          </th>
                          <th className="py-2 font-normal text-right text-sm text-scale-1000">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {migrationPreviewData.monthly_invoice_breakdown.map((item) => (
                          <tr key={item.description} className="border-b">
                            <td className="py-2 text-sm">{item.description ?? 'Unknown'}</td>
                            <td className="py-2 text-sm">{item.quantity}</td>
                            <td className="py-2 text-sm">
                              {item.unit_price === 0 ? 'FREE' : `$${item.unit_price}`}
                            </td>
                            <td className="py-2 text-sm text-right">${item.total_price}</td>
                          </tr>
                        ))}
                      </tbody>

                      <tbody>
                        <tr>
                          <td className="py-2 text-sm">Total</td>
                          <td className="py-2 text-sm" />
                          <td className="py-2 text-sm" />
                          <td className="py-2 text-sm text-right">
                            $
                            {migrationPreviewData.monthly_invoice_breakdown.reduce(
                              (prev, cur) => prev + cur.total_price,
                              0
                            ) ?? 0}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                }
              />
            </Modal.Content>
          )}

          <Modal.Content>
            <Button
              block
              size="small"
              type="primary"
              htmlType="submit"
              loading={isMigrating}
              disabled={migrationPreviewData === undefined || isMigrating || !tier}
              onClick={() => onConfirmMigrate()}
            >
              I understand, migrate this organization
            </Button>
          </Modal.Content>
        </div>
      </Modal>
    </>
  )
})

export default MigrateOrganizationBillingButton
