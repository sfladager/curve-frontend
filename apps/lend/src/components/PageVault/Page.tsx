import type { NextPage } from 'next'
import type { DetailInfoTypes } from '@/components/PageLoanManage/types'

import React, { useCallback, useEffect, useState } from 'react'
import { t } from '@lingui/macro'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { REFRESH_INTERVAL } from '@/constants'
import { _getSelectedTab } from '@/components/PageLoanManage/utils'
import { helpers } from '@/lib/apiLending'
import { scrollToTop } from '@/utils/helpers'
import usePageOnMount from '@/hooks/usePageOnMount'
import useStore from '@/store/useStore'

import {
  PageFormContainer,
  PageFormsWrapper,
  PageFormTitleWrapper,
  PageInfoContentWrapper,
  PageInfoTabsWrapper,
  PageInfoWrapper,
} from '@/components/SharedPageStyles/styles'
import DocumentHead from '@/layout/DocumentHead'
import DetailsMarket from 'components/DetailsMarket'
import DetailsUser from 'components/DetailsUser'
import PageTitleBorrowSupplyLinks from '@/components/SharedPageStyles/PageTitleBorrowSupplyLinks'
import Tabs, { Tab } from '@/ui/Tab'
import Vault from '@/components/PageVault/index'

const Page: NextPage = () => {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { routerParams, api } = usePageOnMount(params, location, navigate)
  const { rChainId, rOwmId, rSubdirectory, rFormType } = routerParams

  const owmData = useStore((state) => state.markets.owmDatasMapper[rChainId]?.[rOwmId])
  const owMDataCached = useStore((state) => state.storeCache.owmDatasMapper[rChainId]?.[rOwmId])
  const owmDataCachedOrApi = owmData ?? owMDataCached
  const isAdvanceMode = useStore((state) => state.isAdvanceMode)
  const isLoadingApi = useStore((state) => state.isLoadingApi)
  const isMdUp = useStore((state) => state.layout.isMdUp)
  const marketDetailsView = useStore((state) => state.markets.marketDetailsView)
  const navHeight = useStore((state) => state.layout.navHeight)
  const fetchAllMarketDetails = useStore((state) => state.markets.fetchAll)
  const fetchAllUserMarketDetails = useStore((state) => state.user.fetchAll)
  const fetchUserLoanExists = useStore((state) => state.user.fetchUserLoanExists)
  const fetchUserMarketBalances = useStore((state) => state.user.fetchUserMarketBalances)
  const setMarketsStateKey = useStore((state) => state.markets.setStateByKey)

  const { signerAddress } = api ?? {}
  const { borrowed_token } = owmDataCachedOrApi?.owm ?? {}

  const [isLoaded, setLoaded] = useState(false)

  // set tabs
  const DETAIL_INFO_TYPES: { key: DetailInfoTypes; label: string }[] = [{ label: t`Supply Details`, key: 'market' }]
  if (signerAddress) {
    DETAIL_INFO_TYPES.push({ label: t`Your Details`, key: 'user' })
  }
  const selectedTab = _getSelectedTab(marketDetailsView, signerAddress)

  const fetchInitial = useCallback(
    async (api: Api, owmData: OWMData) => {
      setLoaded(true)

      // delay fetch rest after form details are fetch first
      setTimeout(async () => {
        const { signerAddress } = api

        fetchAllMarketDetails(api, owmData, true)

        if (signerAddress) {
          const loanExists = (await fetchUserLoanExists(api, owmData, true))?.loanExists
          if (loanExists) {
            fetchAllUserMarketDetails(api, owmData, true)
          } else {
            fetchUserMarketBalances(api, owmData, true)
          }
        }
      }, REFRESH_INTERVAL['3s'])
    },
    [fetchAllMarketDetails, fetchAllUserMarketDetails, fetchUserLoanExists, fetchUserMarketBalances]
  )

  useEffect(() => {
    scrollToTop()
  }, [])

  useEffect(() => {
    setLoaded(false)

    if (!isLoadingApi && api && owmData) {
      fetchInitial(api, owmData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi])

  const TitleComp = () => (
    <PageFormTitleWrapper>
      <PageTitleBorrowSupplyLinks
        rChainId={rChainId}
        rOwmId={rOwmId}
        params={params}
        activeKey="supply"
        owmDataCachedOrApi={owmDataCachedOrApi}
      />
    </PageFormTitleWrapper>
  )

  const pageProps: PageContentProps = {
    rChainId,
    rOwmId,
    rFormType,
    rSubdirectory,
    isLoaded,
    api,
    owmData,
    owmDataCachedOrApi,
    userActiveKey: helpers.getUserActiveKey(api, owmData),
    borrowed_token: owmDataCachedOrApi?.owm?.borrowed_token,
    collateral_token: owmDataCachedOrApi?.owm?.collateral_token,
  }

  return (
    <>
      <DocumentHead title={`${borrowed_token?.symbol ?? ''} | Supply`} />
      <PageFormContainer isAdvanceMode={isAdvanceMode}>
        <PageFormsWrapper navHeight={navHeight}>
          {(!isMdUp || !isAdvanceMode) && <TitleComp />}
          {rChainId && rOwmId && <Vault {...pageProps} />}
        </PageFormsWrapper>

        {isAdvanceMode && rChainId && rOwmId && (
          <PageInfoWrapper>
            {isMdUp && <TitleComp />}
            <PageInfoTabsWrapper>
              <Tabs>
                {DETAIL_INFO_TYPES.map(({ key, label }) => (
                  <Tab
                    key={key}
                    className={selectedTab === key ? 'active' : ''}
                    variant="secondary"
                    disabled={selectedTab === key}
                    onClick={() => setMarketsStateKey('marketDetailsView', key)}
                  >
                    {label}
                  </Tab>
                ))}
              </Tabs>
            </PageInfoTabsWrapper>

            <PageInfoContentWrapper variant="secondary">
              {selectedTab === 'market' && <DetailsMarket {...pageProps} type="supply" />}
              {selectedTab === 'user' && <DetailsUser {...pageProps} type="supply" />}
            </PageInfoContentWrapper>
          </PageInfoWrapper>
        )}
      </PageFormContainer>
    </>
  )
}

export default Page
